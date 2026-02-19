/**
 * Overseerr Auto-Match Service
 * 
 * Proactively links Framerr users to Overseerr accounts by matching
 * Plex usernames. Also fetches and caches Overseerr permissions
 * (including MANAGE_REQUESTS) in linked_accounts metadata.
 * 
 * Triggers (fire-and-forget, no background polling):
 * - Server startup: bulk match all users
 * - Plex SSO login: single user
 * - Manual Plex link: single user
 */

import axios from 'axios';
import { getInstancesByType } from '../db/integrationInstances';
import {
    getLinkedAccount,
    linkAccount,
    getPlexLinkedUsers,
    getUsersLinkedToService,
    updateLinkedAccountMetadata,
} from '../db/linkedAccounts';
import { translateHostUrl } from '../utils/urlHelper';
import { httpsAgent } from '../utils/httpsAgent';
import logger from '../utils/logger';

// Overseerr user shape (subset of what the API returns)
interface OverseerrUser {
    id: number;
    email?: string;
    plexUsername?: string;
    username?: string;
    displayName?: string;
    permissions: number;
}

// Overseerr paginated user response
interface OverseerrUserResponse {
    pageInfo: { pages: number; pageSize: number; results: number; page: number };
    results: OverseerrUser[];
}

/**
 * Fetch all Overseerr users from an instance.
 * Handles pagination to get the full list.
 */
async function fetchOverseerrUsers(
    baseUrl: string,
    apiKey: string
): Promise<OverseerrUser[]> {
    const allUsers: OverseerrUser[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
        const response = await axios.get<OverseerrUserResponse>(
            `${baseUrl}/api/v1/user?take=50&skip=${(page - 1) * 50}`,
            {
                headers: { 'X-Api-Key': apiKey },
                httpsAgent,
                timeout: 15000,
            }
        );

        allUsers.push(...response.data.results);
        totalPages = response.data.pageInfo.pages;
        page++;
    }

    return allUsers;
}

/**
 * Try to auto-match a single Framerr user to an Overseerr account.
 * Called after Plex SSO login or manual Plex link.
 * 
 * If already linked to Overseerr, refreshes permissions only.
 * Fire-and-forget — catches all errors.
 */
export async function tryAutoMatchSingleUser(userId: string): Promise<void> {
    try {
        // Check if user has a Plex account linked
        const plexLink = getLinkedAccount(userId, 'plex');
        if (!plexLink?.externalUsername) {
            logger.debug(`[OverseerrAutoMatch] No Plex username for user=${userId}, skipping`);
            return;
        }

        const plexUsername = plexLink.externalUsername;

        // Get all enabled Overseerr instances
        const overseerrInstances = getInstancesByType('overseerr').filter(i => i.enabled);
        if (overseerrInstances.length === 0) {
            logger.debug('[OverseerrAutoMatch] No enabled Overseerr instances, skipping');
            return;
        }

        // Check if already linked to Overseerr
        const existingLink = getLinkedAccount(userId, 'overseerr');

        for (const instance of overseerrInstances) {
            const baseUrl = translateHostUrl(instance.config.url as string);
            const apiKey = instance.config.apiKey as string;

            try {
                if (existingLink) {
                    // Already linked — just refresh permissions
                    await refreshOverseerrPermissions(userId, existingLink.externalId, baseUrl, apiKey);
                    logger.info(`[OverseerrAutoMatch] Refreshed permissions for user=${userId} overseerrId=${existingLink.externalId}`);
                } else {
                    // Not linked — try to find matching Overseerr user
                    const overseerrUsers = await fetchOverseerrUsers(baseUrl, apiKey);
                    const match = overseerrUsers.find(
                        u => u.plexUsername?.toLowerCase() === plexUsername.toLowerCase()
                    );

                    if (match) {
                        linkAccount(userId, 'overseerr', {
                            externalId: match.id.toString(),
                            externalUsername: match.plexUsername || match.username || match.displayName,
                            externalEmail: match.email,
                            metadata: {
                                linkedVia: 'auto-match',
                                instanceId: instance.id,
                                permissions: match.permissions,
                            },
                        });
                        logger.info(`[OverseerrAutoMatch] Auto-linked: user=${userId} → overseerrId=${match.id} plexUsername=${plexUsername}`);
                    } else {
                        logger.debug(`[OverseerrAutoMatch] No match for plexUsername="${plexUsername}" in instance=${instance.id}`);
                    }
                }

                // Only match against the first instance that processes (avoid duplicate links)
                break;
            } catch (instanceError) {
                logger.warn(`[OverseerrAutoMatch] Failed for instance=${instance.id}: error="${(instanceError as Error).message}"`);
                // Continue to next instance
            }
        }
    } catch (error) {
        logger.error(`[OverseerrAutoMatch] Single user match failed: user=${userId} error="${(error as Error).message}"`);
    }
}

/**
 * Bulk auto-match all Framerr users with Plex accounts to Overseerr.
 * Called at server startup. Also refreshes permissions for existing links.
 * Fire-and-forget — catches all errors.
 */
export async function tryAutoMatchAllUsers(): Promise<void> {
    try {
        const overseerrInstances = getInstancesByType('overseerr').filter(i => i.enabled);
        if (overseerrInstances.length === 0) {
            logger.debug('[OverseerrAutoMatch] No enabled Overseerr instances, skipping bulk match');
            return;
        }

        // Get all Framerr users with linked Plex accounts
        const plexUsers = getPlexLinkedUsers();
        if (plexUsers.length === 0) {
            logger.debug('[OverseerrAutoMatch] No Plex-linked users, skipping bulk match');
            return;
        }

        // Get existing Overseerr links to know who needs matching vs permission refresh
        const existingOverseerrLinks = getUsersLinkedToService('overseerr');
        const alreadyLinkedUserIds = new Set(existingOverseerrLinks.map(l => l.userId));

        let linked = 0;
        let refreshed = 0;
        let skipped = 0;

        for (const instance of overseerrInstances) {
            const baseUrl = translateHostUrl(instance.config.url as string);
            const apiKey = instance.config.apiKey as string;

            try {
                // Fetch all Overseerr users once for this instance
                const overseerrUsers = await fetchOverseerrUsers(baseUrl, apiKey);
                logger.info(`[OverseerrAutoMatch] Fetched ${overseerrUsers.length} Overseerr users from instance=${instance.id}`);

                // Build lookup map (lowercase plexUsername → OverseerrUser)
                const overseerrByPlexUsername = new Map<string, OverseerrUser>();
                for (const user of overseerrUsers) {
                    if (user.plexUsername) {
                        overseerrByPlexUsername.set(user.plexUsername.toLowerCase(), user);
                    }
                }

                for (const { userId, plexUsername } of plexUsers) {
                    const match = overseerrByPlexUsername.get(plexUsername.toLowerCase());

                    if (alreadyLinkedUserIds.has(userId)) {
                        // Already linked — refresh permissions
                        if (match) {
                            const existingLink = getLinkedAccount(userId, 'overseerr');
                            if (existingLink) {
                                const currentMetadata = existingLink.metadata || {};
                                updateLinkedAccountMetadata(userId, 'overseerr', {
                                    ...currentMetadata,
                                    permissions: match.permissions,
                                });
                                refreshed++;
                            }
                        }
                    } else if (match) {
                        // New match — link
                        linkAccount(userId, 'overseerr', {
                            externalId: match.id.toString(),
                            externalUsername: match.plexUsername || match.username || match.displayName,
                            externalEmail: match.email,
                            metadata: {
                                linkedVia: 'auto-match',
                                instanceId: instance.id,
                                permissions: match.permissions,
                            },
                        });
                        alreadyLinkedUserIds.add(userId); // Prevent duplicate links across instances
                        linked++;
                    } else {
                        skipped++;
                    }
                }

                // Only use the first working instance to avoid duplicates
                break;
            } catch (instanceError) {
                logger.warn(`[OverseerrAutoMatch] Bulk match failed for instance=${instance.id}: error="${(instanceError as Error).message}"`);
                // Continue to next instance
            }
        }

        logger.info(`[OverseerrAutoMatch] Bulk match complete: linked=${linked} refreshed=${refreshed} skipped=${skipped}`);
    } catch (error) {
        logger.error(`[OverseerrAutoMatch] Bulk match failed: error="${(error as Error).message}"`);
    }
}

/**
 * Refresh Overseerr permissions for an already-linked user.
 */
async function refreshOverseerrPermissions(
    userId: string,
    overseerrUserId: string,
    baseUrl: string,
    apiKey: string
): Promise<void> {
    const response = await axios.get<OverseerrUser>(
        `${baseUrl}/api/v1/user/${overseerrUserId}`,
        {
            headers: { 'X-Api-Key': apiKey },
            httpsAgent,
            timeout: 10000,
        }
    );

    const existingLink = getLinkedAccount(userId, 'overseerr');
    if (existingLink) {
        const currentMetadata = existingLink.metadata || {};
        updateLinkedAccountMetadata(userId, 'overseerr', {
            ...currentMetadata,
            permissions: response.data.permissions,
        });
    }
}

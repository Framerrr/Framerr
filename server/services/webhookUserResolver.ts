/**
 * Webhook User Resolver Service
 * 
 * Resolves webhook usernames to Framerr users using a cascade:
 * 1. Manual Overseerr link (user_preferences.linkedAccounts.overseerr.username)
 * 2. Plex SSO link (linked_accounts table with matching username)
 * 3. Direct Framerr username match
 * 4. Fallback to admins with receiveUnmatched=true
 */
import { getDb } from '../database/db';
import { listUsers } from '../db/users';
import { getUserConfig } from '../db/userConfig';
import logger from '../utils/logger';

interface User {
    id: string;
    username: string;
    displayName: string;
    group: string;
    isSetupAdmin: boolean;
    createdAt: number;
    lastLogin: number | null;
}

interface LinkedAccountRow {
    user_id: string;
    external_username: string | null;
}

import { plugins } from '../integrations/registry';

interface WebhookConfig {
    adminEvents?: string[];
    userEvents?: string[];
}

/**
 * Get default notification events for a plugin from its schema.
 * Replaces hardcoded SERVICE_MONITORING_DEFAULTS with dynamic lookup.
 */
function getPluginDefaults(pluginType: string): { adminEvents: string[]; userEvents: string[] } {
    const plugin = plugins.find(p => p.id === pluginType);
    if (!plugin || !plugin.notificationMode) {
        return { adminEvents: [], userEvents: [] };
    }

    // Get events from the appropriate source
    const events = plugin.notificationMode === 'webhook'
        ? plugin.webhook?.events || []
        : plugin.notificationEvents || [];

    return {
        adminEvents: events.filter(e => e.defaultAdmin).map(e => e.key),
        userEvents: events.filter(e => e.defaultUser).map(e => e.key),
    };
}

/**
 * Get effective events for a service, falling back to plugin defaults if not configured
 */
function getEffectiveEvents(service: string, webhookConfig: WebhookConfig | null | undefined, isAdmin: boolean): string[] {
    // Look up plugin defaults (works for any plugin type including 'servicemonitoring' mapped to 'monitor')
    const pluginType = service === 'servicemonitoring' ? 'monitor' : service;
    const defaults = getPluginDefaults(pluginType);

    if (isAdmin) {
        return webhookConfig?.adminEvents || defaults.adminEvents;
    }
    return webhookConfig?.userEvents || defaults.userEvents;
}

interface UserSettings {
    enabled?: boolean;
    events?: string[];
}

interface UserConfig {
    preferences?: {
        linkedAccounts?: {
            overseerr?: {
                username?: string;
            };
        };
        notifications?: {
            receiveUnmatched?: boolean;
            integrations?: Record<string, UserSettings>;
        };
    };
}

/**
 * Find Framerr user by external username
 * Uses cascade matching strategy:
 * 1. Overseerr link (linked_accounts.service='overseerr')
 * 2. Plex link (linked_accounts.service='plex')
 * 3. Framerr username match
 */
export async function resolveUserByUsername(externalUsername: string, service: string): Promise<User | null> {
    if (!externalUsername) {
        logger.debug('[WebhookResolver] No username provided');
        return null;
    }

    const normalizedUsername = externalUsername.toLowerCase().trim();
    logger.debug(`[WebhookResolver] Resolving username: external=${externalUsername} service=${service}`);

    try {
        // Strategy 1: Check Overseerr link in linked_accounts table (highest priority)
        const userWithOverseerrLink = await findUserByOverseerrLink(normalizedUsername);
        if (userWithOverseerrLink) {
            logger.info(`[WebhookResolver] Matched via Overseerr link: username=${externalUsername} userId=${userWithOverseerrLink.id}`);
            return userWithOverseerrLink;
        }

        // Strategy 2: Check Plex SSO link in linked_accounts table
        const userWithPlexLink = await findUserByPlexUsername(normalizedUsername);
        if (userWithPlexLink) {
            logger.info(`[WebhookResolver] Matched via Plex SSO link: username=${externalUsername} userId=${userWithPlexLink.id}`);
            return userWithPlexLink;
        }

        // Strategy 3: Direct Framerr username match
        const userByUsername = await findUserByFramerrUsername(normalizedUsername);
        if (userByUsername) {
            logger.info(`[WebhookResolver] Matched via Framerr username: username=${externalUsername} userId=${userByUsername.id}`);
            return userByUsername;
        }

        logger.debug(`[WebhookResolver] No match found: username=${externalUsername}`);
        return null;
    } catch (error) {
        logger.error(`[WebhookResolver] Error resolving user: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Find user by Overseerr link in linked_accounts table
 */
async function findUserByOverseerrLink(username: string): Promise<User | null> {
    try {
        const row = getDb().prepare(`
            SELECT user_id, external_username FROM linked_accounts 
            WHERE service = 'overseerr' AND LOWER(external_username) = ?
        `).get(username) as LinkedAccountRow | undefined;

        if (!row) return null;

        // Get full user object
        const users = await listUsers() as User[];
        return users.find(u => u.id === row.user_id) || null;
    } catch (error) {
        logger.error(`[WebhookResolver] Error checking Overseerr links: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Find user by manual Overseerr link in user_preferences
 */
async function findUserByManualOverseerrLink(username: string): Promise<User | null> {
    try {
        const users = await listUsers() as User[];

        for (const user of users) {
            const config = await getUserConfig(user.id) as UserConfig;
            const overseerrLink = config?.preferences?.linkedAccounts?.overseerr?.username;

            if (overseerrLink && overseerrLink.toLowerCase().trim() === username) {
                return user;
            }
        }

        return null;
    } catch (error) {
        logger.error(`[WebhookResolver] Error checking manual Overseerr links: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Find user by Plex SSO username in linked_accounts table
 */
async function findUserByPlexUsername(username: string): Promise<User | null> {
    try {
        const row = getDb().prepare(`
            SELECT user_id, external_username FROM linked_accounts 
            WHERE service = 'plex' AND LOWER(external_username) = ?
        `).get(username) as LinkedAccountRow | undefined;

        if (!row) return null;

        // Get full user object
        const users = await listUsers() as User[];
        return users.find(u => u.id === row.user_id) || null;
    } catch (error) {
        logger.error(`[WebhookResolver] Error checking Plex SSO links: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Find user by Framerr username
 */
async function findUserByFramerrUsername(username: string): Promise<User | null> {
    try {
        const users = await listUsers() as User[];
        return users.find(u => u.username.toLowerCase() === username) || null;
    } catch (error) {
        logger.error(`[WebhookResolver] Error checking Framerr usernames: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Get all admin users who have receiveUnmatched enabled
 */
export async function getAdminsWithReceiveUnmatched(): Promise<User[]> {
    try {
        const users = await listUsers() as User[];
        const admins = users.filter(u => u.group === 'admin');

        const adminsWithUnmatched: User[] = [];

        for (const admin of admins) {
            const config = await getUserConfig(admin.id) as UserConfig;
            const receiveUnmatched = config?.preferences?.notifications?.receiveUnmatched ?? true;

            if (receiveUnmatched) {
                adminsWithUnmatched.push(admin);
            }
        }

        return adminsWithUnmatched;
    } catch (error) {
        logger.error(`[WebhookResolver] Error getting admins with receiveUnmatched: error="${(error as Error).message}"`);
        return [];
    }
}

/**
 * Check if a user has a specific event enabled in their notification preferences
 */
export async function userWantsEvent(
    userId: string,
    service: string,
    eventKey: string,
    isAdmin: boolean,
    webhookConfig: WebhookConfig | null | undefined
): Promise<boolean> {
    try {
        // Get effective events (falls back to defaults for servicemonitoring)
        const allowedEvents = getEffectiveEvents(service, webhookConfig, isAdmin);

        if (isAdmin) {
            // Admins check against adminEvents
            return allowedEvents.includes(eventKey);
        }

        // Non-admin: Check if event is in userEvents AND user has it enabled
        if (!allowedEvents.includes(eventKey)) {
            return false; // Admin hasn't allowed this event for users
        }

        // Check user's personal preferences
        const config = await getUserConfig(userId) as UserConfig;
        const userSettings = config?.preferences?.notifications?.integrations?.[service];

        // If user has integration disabled, don't send
        if (userSettings?.enabled === false) {
            return false;
        }

        // Check if user has this specific event enabled
        const userEvents = userSettings?.events;
        if (!userEvents || userEvents.length === 0) {
            // User hasn't configured specific events, use all allowed
            return true;
        }

        return userEvents.includes(eventKey);
    } catch (error) {
        logger.error(`[WebhookResolver] Error checking user event preference: error="${(error as Error).message}"`);
        return false;
    }
}


/**
 * Plex Library Access Check
 * 
 * Shared helper to verify a Plex user has library access on the admin's server.
 * Used by both SSO login (auth.ts) and manual Plex linking (linkedAccounts.ts).
 */
import axios from 'axios';
import xml2js from 'xml2js';
import logger from './logger';

interface SharedServer {
    userID?: string;
    invitedId?: string;
    id?: string;
    username?: string;
    email?: string;
}

interface ParsedSharedServersXML {
    MediaContainer?: {
        SharedServer?: SharedServer | SharedServer[];
    };
    SharedServer?: SharedServer | SharedServer[];
}

interface PlexSSOConfig {
    adminToken: string;
    machineId: string;
    clientIdentifier: string;
    adminPlexId?: string;
}

interface LibraryAccessResult {
    hasAccess: boolean;
    isAdmin: boolean;
}

/**
 * Check if a Plex user has library access on the admin's Plex server.
 * 
 * - If the user IS the Plex admin → returns { hasAccess: true, isAdmin: true }
 * - If the user IS in the shared_servers list → returns { hasAccess: true, isAdmin: false }
 * - If the user is NOT in the list → returns { hasAccess: false, isAdmin: false }
 * - Throws on network/config errors (caller must handle)
 */
export async function checkPlexLibraryAccess(
    plexUserId: string,
    ssoConfig: PlexSSOConfig
): Promise<LibraryAccessResult> {
    // Check if this user is the Plex admin
    const isPlexAdmin = ssoConfig.adminPlexId
        ? plexUserId === ssoConfig.adminPlexId.toString()
        : false;

    if (isPlexAdmin) {
        logger.info(`[PlexLibraryAccess] User is Plex admin, skipping library check: plexUserId=${plexUserId}`);
        return { hasAccess: true, isAdmin: true };
    }

    // Fetch shared servers list using admin token
    if (!ssoConfig.machineId) {
        throw new Error('No Plex machine ID configured');
    }

    let sharedUsers: SharedServer[] = [];

    const sharedServersResponse = await axios.get<string>(
        `https://plex.tv/api/servers/${ssoConfig.machineId}/shared_servers`,
        {
            headers: {
                'Accept': 'application/json',
                'X-Plex-Token': ssoConfig.adminToken,
                'X-Plex-Client-Identifier': ssoConfig.clientIdentifier
            }
        }
    );

    const responseData = sharedServersResponse.data;
    logger.debug(`[PlexLibraryAccess] shared_servers response: status=${sharedServersResponse.status} dataType=${typeof responseData}`);

    // API returns XML, not JSON - need to parse it
    if (typeof responseData === 'string' && responseData.includes('<?xml')) {
        const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
        const parsed = await parser.parseStringPromise(responseData) as ParsedSharedServersXML;

        const sharedServers = parsed?.MediaContainer?.SharedServer;
        if (sharedServers) {
            sharedUsers = Array.isArray(sharedServers) ? sharedServers : [sharedServers];
        }

        logger.debug(`[PlexLibraryAccess] Parsed XML shared users: count=${sharedUsers.length}`);
    } else if (typeof responseData === 'object' && (responseData as unknown as ParsedSharedServersXML)?.MediaContainer?.SharedServer) {
        const data = responseData as unknown as ParsedSharedServersXML;
        const sharedServers = data.MediaContainer!.SharedServer;
        sharedUsers = Array.isArray(sharedServers) ? sharedServers : [sharedServers!];
    }

    // Check if user has library access
    const hasLibraryAccess = sharedUsers.some(sharedUser => {
        const sharedUserId = sharedUser.userID || sharedUser.invitedId || sharedUser.id;
        const matches = sharedUserId?.toString() === plexUserId;
        if (matches) {
            logger.debug(`[PlexLibraryAccess] Found matching shared user: userId=${sharedUserId} username=${sharedUser.username || sharedUser.email}`);
        }
        return matches;
    });

    if (!hasLibraryAccess) {
        logger.warn(`[PlexLibraryAccess] User does not have library access: plexUserId=${plexUserId} machineId=${ssoConfig.machineId}`);
    } else {
        logger.info(`[PlexLibraryAccess] User has library access: plexUserId=${plexUserId}`);
    }

    return { hasAccess: hasLibraryAccess, isAdmin: false };
}

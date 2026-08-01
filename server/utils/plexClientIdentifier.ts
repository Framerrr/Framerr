/**
 * Persistent Plex X-Plex-Client-Identifier for this Framerr instance.
 *
 * Plex auth tokens from the PIN flow are associated with the client id used
 * at claim time. Regenerating the id while keeping an old adminToken causes
 * plex.tv /api/v2/resources (and related) calls to 401 — which breaks the
 * server dropdown refresh and shared-user SSO library checks.
 */
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';
import { getSystemConfig, updateSystemConfig } from '../db/systemConfig';

let cachedClientIdentifier: string | null = null;
let loadingPromise: Promise<string> | null = null;

/** Test helper — clear in-memory cache between tests */
export function resetPlexClientIdentifierCache(): void {
    cachedClientIdentifier = null;
    loadingPromise = null;
}

/**
 * Get or create the stable Plex client identifier.
 * Concurrent callers share one in-flight load/create (no dual-generate race).
 */
export async function getPlexClientIdentifier(): Promise<string> {
    if (cachedClientIdentifier) {
        return cachedClientIdentifier;
    }
    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = (async () => {
        try {
            const config = await getSystemConfig();
            const existing = config.plexSSO?.clientIdentifier;

            if (typeof existing === 'string' && existing.length > 0) {
                cachedClientIdentifier = existing;
                logger.debug('[Plex] Using existing client identifier from DB');
                return existing;
            }

            if (config.plexSSO?.adminToken) {
                // Broken state: token without the client id it was minted under.
                logger.warn(
                    '[Plex] adminToken present without clientIdentifier — generating a new id. ' +
                    'Plex API calls may 401 until an admin reconnects Plex in Auth settings.'
                );
            }

            const clientId = `framerr-${uuidv4()}`;
            await updateSystemConfig({
                plexSSO: {
                    ...(config.plexSSO || {}),
                    clientIdentifier: clientId
                }
            });
            cachedClientIdentifier = clientId;
            logger.info(`[Plex] Generated new client identifier: id=${clientId}`);
            return clientId;
        } finally {
            loadingPromise = null;
        }
    })();

    return loadingPromise;
}

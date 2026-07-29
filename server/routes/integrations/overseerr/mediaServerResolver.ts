import { getInstancesByType, type IntegrationInstance } from '../../../db/integrationInstances';
import { getPlugin } from '../../../integrations/registry';
import { toPluginInstance } from '../../../integrations/utils';
import logger from '../../../utils/logger';

export interface ResolvedMediaServer {
    type: 'plex' | 'jellyfin';
    integrationId: string;
}

interface RawOverseerrMedia {
    ratingKey?: string;
    jellyfinMediaId?: string;
}

/** Enabled Plex + Jellyfin instances — same reuse pattern as servers.ts's
 *  `getInstancesByType('radarr').filter(i => i.enabled)` Radarr/Sonarr discovery,
 *  extended to both media-server types. Deliberately NOT `getMediaServerIntegrationsWithSync()` —
 *  that helper additionally requires `librarySyncEnabled`, an unrelated poller/sync concern
 *  that would hide the CTA for a valid, enabled, but sync-disabled integration. */
function getEnabledMediaServerInstances(): IntegrationInstance[] {
    return [...getInstancesByType('plex'), ...getInstancesByType('jellyfin')].filter(i => i.enabled);
}

/** Pure: decide type + candidate list from already-fetched integration instances. No I/O. */
export function pickMediaServerCandidates(
    media: RawOverseerrMedia | undefined,
    enabledInstances: IntegrationInstance[]
): { type: 'plex' | 'jellyfin'; candidates: IntegrationInstance[] } | null {
    if (media?.ratingKey) {
        return { type: 'plex', candidates: enabledInstances.filter(i => i.type === 'plex') };
    }
    if (media?.jellyfinMediaId) {
        return { type: 'jellyfin', candidates: enabledInstances.filter(i => i.type === 'jellyfin') };
    }
    return null;
}

/** Fetch a Plex instance's live machineIdentifier the same way /proxy/machineId does. */
async function fetchPlexMachineId(instance: IntegrationInstance): Promise<string | null> {
    try {
        const adapter = getPlugin('plex')!.adapter;
        const response = await adapter.get!(toPluginInstance(instance), '/', {
            headers: { Accept: 'application/xml' },
            timeout: 10000,
        });
        const match = String(response.data).match(/machineIdentifier="([^"]+)"/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

/**
 * Resolve which Framerr Plex/Jellyfin integration backs a given Overseerr request's media.
 * Returns null if unresolvable — callers must hide the CTA in that case, never guess.
 */
export async function resolveMediaServer(
    overseerrInstance: IntegrationInstance,
    media: RawOverseerrMedia | undefined
): Promise<ResolvedMediaServer | null> {
    const picked = pickMediaServerCandidates(media, getEnabledMediaServerInstances());
    if (!picked || picked.candidates.length === 0) return null;
    if (picked.candidates.length === 1) {
        return { type: picked.type, integrationId: picked.candidates[0].id };
    }
    // Multiple candidates — only Plex disambiguation is attempted (see Design Rationale).
    if (picked.type !== 'plex') return null;
    try {
        const adapter = getPlugin('overseerr')!.adapter;
        const settingsResp = await adapter.get!(toPluginInstance(overseerrInstance), '/api/v1/settings/plex', { timeout: 10000 });
        const overseerrMachineId: string | undefined = settingsResp.data?.machineId;
        if (!overseerrMachineId) return null;
        for (const candidate of picked.candidates) {
            const candidateMachineId = await fetchPlexMachineId(candidate);
            if (candidateMachineId && candidateMachineId === overseerrMachineId) {
                return { type: 'plex', integrationId: candidate.id };
            }
        }
        return null;
    } catch (err) {
        logger.debug(`[Overseerr Proxy] Media server disambiguation failed: error="${(err as Error).message}"`);
        return null;
    }
}

/**
 * Media Stream Adapters - Barrel Export
 *
 * Provides adapter factory and re-exports all adapter types.
 */

// Type exports
export type {
    MediaSession,
    MediaSessionsResponse,
    SessionAdapter,
    IntegrationType,
} from './types';

// Adapter exports
export { plexAdapter } from './plex';
export { jellyfinAdapter } from './jellyfin';
export { embyAdapter } from './emby';

// ============================================================================
// ADAPTER FACTORY
// ============================================================================

import type { SessionAdapter, IntegrationType } from './types';
import { plexAdapter } from './plex';
import { jellyfinAdapter } from './jellyfin';
import { embyAdapter } from './emby';

const adapters: Record<IntegrationType, SessionAdapter> = {
    plex: plexAdapter,
    jellyfin: jellyfinAdapter,
    emby: embyAdapter,
};

/**
 * Get the appropriate adapter for an integration type.
 * Falls back to Plex adapter if type is unknown.
 */
export function getAdapter(integrationType: string): SessionAdapter {
    return adapters[integrationType as IntegrationType] || plexAdapter;
}

/**
 * Check if a string is a valid integration type.
 */
export function isValidIntegrationType(type: string): type is IntegrationType {
    return type === 'plex' || type === 'jellyfin' || type === 'emby';
}

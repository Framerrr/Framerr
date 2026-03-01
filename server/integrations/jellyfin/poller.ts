import { PluginInstance, PluginAdapter } from '../types';
import logger from '../../utils/logger';

// ============================================================================
// JELLYFIN SESSION TYPES
// ============================================================================

export interface JellyfinSession {
    Id: string;
    UserName: string;
    Client: string;
    DeviceName: string;
    DeviceId: string;
    NowPlayingItem?: {
        Id: string;
        Name: string;
        SeriesName?: string;
        ParentIndexNumber?: number;
        IndexNumber?: number;
        Type: string;
        RunTimeTicks?: number;
        ImageTags?: Record<string, string>;
    };
    PlayState?: {
        PositionTicks?: number;
        IsPaused?: boolean;
        IsMuted?: boolean;
    };
    SupportsMediaControl?: boolean;
    SupportsRemoteControl?: boolean;
}

// ============================================================================
// JELLYFIN POLLER
// ============================================================================

export const intervalMs = 30000; // 30 seconds

export async function poll(instance: PluginInstance, _adapter?: PluginAdapter): Promise<JellyfinSession[]> {
    if (!_adapter) {
        throw new Error('Adapter required for Jellyfin poller');
    }

    const response = await _adapter.get!(instance, '/Sessions');

    // Filter to only sessions with active playback
    const activeSessions = (response.data as JellyfinSession[]).filter(
        (session) => session.NowPlayingItem != null
    );

    logger.debug(`[Poller:jellyfin] Found ${activeSessions.length} active sessions`);
    return activeSessions;
}

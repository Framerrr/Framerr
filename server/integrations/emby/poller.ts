import { PluginInstance, PluginAdapter } from '../types';
import logger from '../../utils/logger';

// ============================================================================
// EMBY SESSION TYPES
// ============================================================================

export interface EmbySession {
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
// EMBY POLLER
// ============================================================================

export const intervalMs = 30000; // 30 seconds

export async function poll(instance: PluginInstance, _adapter?: PluginAdapter): Promise<EmbySession[]> {
    if (!_adapter) {
        throw new Error('Adapter required for Emby poller');
    }

    const response = await _adapter.get!(instance, '/Sessions');

    // Filter to only sessions with active playback
    const activeSessions = (response.data as EmbySession[]).filter(
        (session) => session.NowPlayingItem != null
    );

    logger.debug(`[Poller:emby] Found ${activeSessions.length} active sessions`);
    return activeSessions;
}

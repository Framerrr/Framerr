import axios from 'axios';
import { PluginInstance } from '../types';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
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

export async function poll(instance: PluginInstance): Promise<EmbySession[]> {
    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        throw new Error('URL and API key required');
    }

    const baseUrl = translateHostUrl(url).replace(/\/$/, '');
    const response = await axios.get<EmbySession[]>(`${baseUrl}/Sessions`, {
        headers: {
            'X-Emby-Token': apiKey,
            'Accept': 'application/json',
        },
        httpsAgent,
        timeout: 10000,
    });

    // Filter to only sessions with active playback
    const activeSessions = response.data.filter(
        (session) => session.NowPlayingItem != null
    );

    logger.debug(`[Poller:emby] Found ${activeSessions.length} active sessions`);
    return activeSessions;
}

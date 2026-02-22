import axios from 'axios';
import { PluginInstance } from '../types';
import { httpsAgent } from '../../utils/httpsAgent';
import { translateHostUrl } from '../../utils/urlHelper';
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

export async function poll(instance: PluginInstance): Promise<JellyfinSession[]> {
    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        throw new Error('URL and API key required');
    }

    const baseUrl = translateHostUrl(url).replace(/\/$/, '');
    const response = await axios.get<JellyfinSession[]>(`${baseUrl}/Sessions`, {
        headers: {
            'Authorization': `MediaBrowser Token="${apiKey}"`,
            'Accept': 'application/json',
        },
        httpsAgent,
        timeout: 10000,
    });

    // Filter to only sessions with active playback
    const activeSessions = response.data.filter(
        (session) => session.NowPlayingItem != null
    );

    logger.debug(`[Poller:jellyfin] Found ${activeSessions.length} active sessions`);
    return activeSessions;
}

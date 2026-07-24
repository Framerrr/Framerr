import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance } from '../types';

// ============================================================================
// LIDARR ADAPTER
// ============================================================================

export class LidarrAdapter extends BaseAdapter {
    readonly testEndpoint = '/api/v1/system/status';

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        return { 'X-Api-Key': instance.config.apiKey as string };
    }
}

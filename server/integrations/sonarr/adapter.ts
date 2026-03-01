import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance } from '../types';

// ============================================================================
// SONARR ADAPTER
// ============================================================================

export class SonarrAdapter extends BaseAdapter {
    readonly testEndpoint = '/api/v3/system/status';

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        return { 'X-Api-Key': instance.config.apiKey as string };
    }
}

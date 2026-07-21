import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance } from '../types';

// ============================================================================
// PROWLARR ADAPTER
// ============================================================================

export class ProwlarrAdapter extends BaseAdapter {
    readonly testEndpoint = '/api/v1/system/status';

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        return { 'X-Api-Key': instance.config.apiKey as string };
    }
}

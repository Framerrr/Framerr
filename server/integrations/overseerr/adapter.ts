import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance } from '../types';

// ============================================================================
// OVERSEERR ADAPTER
// ============================================================================

export class OverseerrAdapter extends BaseAdapter {
    readonly testEndpoint = '/api/v1/settings/public';

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        return { 'X-Api-Key': instance.config.apiKey as string };
    }
}

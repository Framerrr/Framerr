/**
 * Custom System Status Integration - Adapter
 *
 * Extends BaseAdapter with optional Bearer token authentication.
 * Token is optional — the custom API can run without authentication.
 */

import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance } from '../types';

// ============================================================================
// CUSTOM SYSTEM STATUS ADAPTER
// ============================================================================

export class CustomSystemStatusAdapter extends BaseAdapter {
    readonly testEndpoint = '/status';

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        const token = instance.config.token as string;
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }
}

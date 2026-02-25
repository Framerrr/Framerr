/**
 * Glances Integration - Adapter
 *
 * Extends BaseAdapter with optional X-Auth header authentication.
 * Password is optional — Glances can run without authentication.
 */

import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance } from '../types';

// ============================================================================
// GLANCES ADAPTER
// ============================================================================

export class GlancesAdapter extends BaseAdapter {
    readonly testEndpoint = '/api/4/cpu';

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        const password = instance.config.password as string;
        if (password) {
            headers['X-Auth'] = password;
        }
        return headers;
    }
}

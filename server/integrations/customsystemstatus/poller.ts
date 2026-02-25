/**
 * Custom System Status Poller
 * 
 * Polls user's custom monitoring API for real-time widget updates.
 */

import { PluginInstance, PluginAdapter } from '../types';

// ============================================================================
// CUSTOM SYSTEM STATUS POLLER
// ============================================================================

/** Polling interval in milliseconds (2 seconds) */
export const intervalMs = 5000;

/** Custom system status data shape for SSE */
export interface CustomSystemData {
    cpu: number;
    memory: number;
    temperature: number | null;
    uptime: string;
}

/**
 * Poll custom system status API.
 */
export async function poll(instance: PluginInstance, adapter: PluginAdapter): Promise<CustomSystemData> {
    // The custom API should return the status data at /status endpoint
    // Errors propagate to orchestrator
    const response = await adapter.get!(instance, '/status', { timeout: 20000 });
    const data = response.data;

    // Normalize the response
    let cpu = 0, memory = 0, uptime = '--';
    let temperature: number | null = null;

    if (typeof data.cpu === 'number') {
        cpu = Math.round(data.cpu);
    }
    if (typeof data.memory === 'number') {
        memory = Math.round(data.memory);
    }
    if (typeof data.temperature === 'number') {
        temperature = Math.round(data.temperature);
    }
    if (typeof data.uptime === 'string') {
        uptime = data.uptime;
    } else if (typeof data.uptime === 'number') {
        const seconds = data.uptime;
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        uptime = days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`;
    }

    return { cpu, memory, temperature, uptime };
}

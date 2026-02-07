/**
 * Custom System Status Poller
 * 
 * Polls user's custom monitoring API for real-time widget updates.
 */

import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';

// ============================================================================
// CUSTOM SYSTEM STATUS POLLER
// ============================================================================

/** Polling interval in milliseconds (2 seconds) */
export const intervalMs = 2000;

/** Custom system status data shape for SSE */
export interface CustomSystemData {
    cpu: number;
    memory: number;
    temperature: number;
    uptime: string;
}

/**
 * Poll custom system status API.
 */
export async function poll(instance: PluginInstance): Promise<CustomSystemData | null> {
    if (!instance.config.url) {
        return null;
    }

    const url = (instance.config.url as string).replace(/\/$/, '');
    const token = instance.config.token as string | undefined;

    try {
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // The custom API should return the status data at /status endpoint
        const response = await axios.get(`${url}/status`, { headers, httpsAgent, timeout: 10000 });
        const data = response.data;

        // Normalize the response
        let cpu = 0, memory = 0, temperature = 0, uptime = '--';

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
    } catch {
        return null;
    }
}

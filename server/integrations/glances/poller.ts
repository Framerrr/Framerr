/**
 * Glances Poller
 * 
 * Polls Glances system monitoring data for real-time widget updates.
 */

import { PluginInstance } from '../types';
import axios from 'axios';
import { httpsAgent } from '../../utils/httpsAgent';

// ============================================================================
// GLANCES POLLER
// ============================================================================

/** Polling interval in milliseconds (2 seconds) */
export const intervalMs = 2000;

/** Glances data shape for SSE */
export interface GlancesData {
    cpu: number;
    memory: number;
    temperature: number;
    uptime: string;
}

/**
 * Poll Glances for system status.
 */
export async function poll(instance: PluginInstance): Promise<GlancesData | null> {
    if (!instance.config.url) {
        return null;
    }

    const url = (instance.config.url as string).replace(/\/$/, '');
    const password = instance.config.password as string | undefined;

    try {
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (password) {
            headers['X-Auth'] = password;
        }

        // Fetch endpoints in parallel
        const [quicklookRes, sensorsRes, uptimeRes] = await Promise.allSettled([
            axios.get(`${url}/api/4/quicklook`, { headers, httpsAgent, timeout: 10000 }),
            axios.get(`${url}/api/4/sensors`, { headers, httpsAgent, timeout: 10000 }),
            axios.get(`${url}/api/4/uptime`, { headers, httpsAgent, timeout: 10000 })
        ]);

        let cpu = 0, memory = 0, temperature = 0, uptime = '--';

        if (quicklookRes.status === 'fulfilled') {
            cpu = Math.round(quicklookRes.value.data.cpu || 0);
            memory = Math.round(quicklookRes.value.data.mem || 0);
        }

        if (sensorsRes.status === 'fulfilled') {
            const sensors = sensorsRes.value.data;
            if (Array.isArray(sensors)) {
                const cpuSensor = sensors.find((s: { label?: string; type?: string }) =>
                    s.label?.toLowerCase().includes('cpu') ||
                    s.label?.toLowerCase().includes('core') ||
                    s.type === 'temperature_core'
                );
                if (cpuSensor && typeof cpuSensor.value === 'number') {
                    temperature = Math.round(cpuSensor.value);
                }
            }
        }

        if (uptimeRes.status === 'fulfilled') {
            const uptimeData = uptimeRes.value.data;
            if (typeof uptimeData === 'string') {
                uptime = uptimeData;
            } else if (typeof uptimeData === 'number') {
                const seconds = uptimeData;
                const days = Math.floor(seconds / 86400);
                const hours = Math.floor((seconds % 86400) / 3600);
                const mins = Math.floor((seconds % 3600) / 60);
                uptime = days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`;
            }
        }

        return { cpu, memory, temperature, uptime };
    } catch {
        return null;
    }
}

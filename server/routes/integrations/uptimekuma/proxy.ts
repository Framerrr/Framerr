/**
 * Uptime Kuma Proxy Routes
 * 
 * Handles Uptime Kuma API proxying:
 * - /monitors - Get monitor statuses
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../../../utils/logger';
import { httpsAgent } from '../../../utils/httpsAgent';
import { translateHostUrl } from '../../../utils/urlHelper';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';

const router = Router();

/**
 * GET /:id/proxy/monitors - Get Uptime Kuma monitor statuses
 */
router.get('/:id/proxy/monitors', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'uptimekuma') {
        res.status(404).json({ error: 'Uptime Kuma integration not found' });
        return;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('uptimekuma', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Uptime Kuma configuration' });
        return;
    }

    try {
        const translatedUrl = translateHostUrl(url);

        // Use Prometheus /metrics endpoint with Basic auth
        const authHeader = `Basic ${Buffer.from(':' + apiKey).toString('base64')}`;

        const response = await axios.get(`${translatedUrl}/metrics`, {
            headers: { 'Authorization': authHeader },
            httpsAgent,
            timeout: 10000
        });

        const metricsText = response.data as string;

        // Check if we got HTML (auth failed)
        if (metricsText.startsWith('<!DOCTYPE') || metricsText.startsWith('<html')) {
            res.status(401).json({ error: 'Authentication failed' });
            return;
        }

        // Parse Prometheus format
        const monitors: { id: string; name: string; status: number; latency?: number }[] = [];
        const monitorMap = new Map<string, { name: string; status: number }>();
        const latencyMap = new Map<string, number>();

        const lines = metricsText.split('\n');

        for (const line of lines) {
            if (line.startsWith('monitor_status{')) {
                const match = line.match(/monitor_status\{([^}]+)\}\s+(\d+)/);
                if (match) {
                    const labels = match[1];
                    const status = parseInt(match[2]);

                    // Skip pending (status 2)
                    if (status === 2) continue;

                    const nameMatch = labels.match(/monitor_name="([^"]*)"/);
                    const name = nameMatch?.[1] || 'Unknown';

                    if (!monitorMap.has(name)) {
                        monitorMap.set(name, { name, status });
                    }
                }
            }

            if (line.startsWith('monitor_response_time{')) {
                const match = line.match(/monitor_name="([^"]*)".*\}\s+(\d+)/);
                if (match) {
                    latencyMap.set(match[1], parseInt(match[2]));
                }
            }
        }

        for (const [name, data] of monitorMap.entries()) {
            monitors.push({
                id: name,
                name: data.name,
                status: data.status,
                latency: latencyMap.get(name)
            });
        }

        res.json({ monitors });
    } catch (error) {
        logger.error(`[UptimeKuma Proxy] Monitors error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch monitors' });
    }
});

/**
 * POST /uptimekuma/monitors-preview
 * Fetch available monitors from UK using provided credentials (ADMIN ONLY)
 * Used by UptimeKumaForm for monitor selection
 */
router.post('/uptimekuma/monitors-preview', requireAuth, async (req: Request, res: Response): Promise<void> => {
    // Only admins can use this endpoint
    if (req.user?.group !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }

    const { url, apiKey } = req.body;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'URL and API key required' });
        return;
    }

    try {
        const translatedUrl = translateHostUrl(url);

        // Basic auth with empty username, API key as password
        const authHeader = `Basic ${Buffer.from(':' + apiKey).toString('base64')}`;

        const response = await axios.get(`${translatedUrl}/metrics`, {
            headers: { 'Authorization': authHeader },
            httpsAgent,
            timeout: 10000
        });

        const metricsText = response.data as string;

        // Check if we got HTML (auth failed)
        if (metricsText.startsWith('<!DOCTYPE') || metricsText.startsWith('<html')) {
            res.status(401).json({ error: 'Authentication failed - invalid API key' });
            return;
        }

        // Parse Prometheus format
        const monitors: { id: string; name: string; type: string; url?: string; active: boolean; latency?: number }[] = [];
        const monitorMap = new Map<string, { name: string; type: string; url?: string; status: number }>();
        const latencyMap = new Map<string, number>();

        const lines = metricsText.split('\n');

        for (const line of lines) {
            if (line.startsWith('monitor_status{')) {
                const match = line.match(/monitor_status\{([^}]+)\}\s+(\d+)/);
                if (match) {
                    const labels = match[1];
                    const status = parseInt(match[2]);

                    // Skip pending (status 2)
                    if (status === 2) continue;

                    const nameMatch = labels.match(/monitor_name="([^"]*)"/);
                    const typeMatch = labels.match(/monitor_type="([^"]*)"/);
                    const urlMatch = labels.match(/monitor_url="([^"]*)"/);
                    const name = nameMatch?.[1] || 'Unknown';

                    if (!monitorMap.has(name)) {
                        monitorMap.set(name, {
                            name,
                            type: typeMatch?.[1] || 'http',
                            url: urlMatch?.[1] || undefined,
                            status
                        });
                    }
                }
            }

            if (line.startsWith('monitor_response_time{')) {
                const match = line.match(/monitor_name="([^"]*)".*\}\s+(\d+)/);
                if (match) {
                    latencyMap.set(match[1], parseInt(match[2]));
                }
            }
        }

        for (const [name, data] of monitorMap.entries()) {
            monitors.push({
                id: name,
                name: data.name,
                type: data.type,
                url: data.url,
                active: data.status === 1,
                latency: latencyMap.get(name)
            });
        }

        logger.info(`[UptimeKuma] Monitors preview: count=${monitors.length}`);
        res.json({ monitors });
    } catch (error) {
        const axiosError = error as { response?: { status?: number; statusText?: string }; message?: string };
        logger.error(`[UptimeKuma Proxy] Monitors preview error: error="${axiosError.message}"`);

        if (axiosError.response?.status === 401) {
            res.status(401).json({ error: 'Authentication failed - check API key' });
        } else {
            res.status(500).json({ error: axiosError.message || 'Failed to fetch monitors' });
        }
    }
});

export default router;

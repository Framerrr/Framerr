import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';
import axios from 'axios';

const router = Router();

interface DatabaseTestResult {
    success: boolean;
    status: string;
    latency: number;
    details?: {
        path: string;
        sizeKB: number;
        accessible: boolean;
        userCount: number;
        tableCount: number;
        type: string;
    };
    error?: string;
}

interface EndpointResult {
    name: string;
    path: string;
    status: string;
    responseTime: number;
    error?: string;
}

interface DownloadBody {
    size?: number;
}

// All diagnostics routes require admin access
router.use(requireAdmin);

/**
 * Test SQLite database connection and latency
 */
router.get('/database', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getDb } = require('../database/db');
        const db = getDb();
        const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
        const dbPath = path.join(DATA_DIR, 'framerr.db');

        // Test database query to verify connection
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
        const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];

        // Get file stats
        const stats = await fs.stat(dbPath);

        const latency = Date.now() - startTime;

        const result: DatabaseTestResult = {
            success: true,
            status: 'healthy',
            latency,
            details: {
                path: dbPath,
                sizeKB: Math.round(stats.size / 1024),
                accessible: true,
                userCount: userCount.count,
                tableCount: tableInfo.length,
                type: 'SQLite'
            }
        };

        res.json(result);
    } catch (error) {
        logger.error(`[Diagnostics] Database test failed: error="${(error as Error).message}"`);
        const latency = Date.now() - startTime;

        const result: DatabaseTestResult = {
            success: false,
            status: 'error',
            latency,
            error: (error as Error).message
        };

        res.json(result);
    }
});

/**
 * Simple ping for latency test
 */
router.get('/ping', (req: Request, res: Response) => {
    res.json({ success: true, timestamp: Date.now() });
});

/**
 * Download speed test - send data chunks to client
 */
router.post('/download', (req: Request, res: Response) => {
    try {
        const { size = 1 } = req.body as DownloadBody;
        const bytes = size * 1024 * 1024;

        // Generate random data
        const chunk = Buffer.alloc(bytes, 'x');

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', chunk.length);
        res.send(chunk);
    } catch (error) {
        logger.error(`[Diagnostics] Download test failed: error="${(error as Error).message}"`);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * Upload speed test - receive data chunks from client
 * Uses larger body limit for speed testing
 */
import express from 'express';
router.post('/upload', express.json({ limit: '50mb' }), (req: Request, res: Response) => {
    try {
        // Client sends data in req.body
        const receivedBytes = JSON.stringify(req.body).length;

        res.json({
            success: true,
            receivedBytes
        });
    } catch (error) {
        logger.error(`[Diagnostics] Upload test failed: error="${(error as Error).message}"`);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * Warmup endpoint - small request to prime TCP connection
 */
router.get('/warmup', (req: Request, res: Response) => {
    // Send 100KB to warm up the connection
    const chunk = Buffer.alloc(100 * 1024, 'x');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', chunk.length);
    res.send(chunk);
});

/**
 * Integration health check - test connectivity to enabled integrations
 */
router.get('/integration-health', async (req: Request, res: Response) => {
    try {
        const { getSystemConfig } = await import('../db/systemConfig');
        const { translateHostUrl } = await import('../utils/urlHelper');
        const https = await import('https');
        const httpsAgent = new https.Agent({ rejectUnauthorized: false });

        const config = await getSystemConfig();
        const integrations = config.integrations || {};

        // Whitelist of known integrations to filter out stale data
        const knownIntegrations = ['plex', 'sonarr', 'radarr', 'overseerr', 'qbittorrent', 'systemstatus'];

        interface IntegrationStatus {
            name: string;
            enabled: boolean;
            connected: boolean;
            responseTime?: number;
            error?: string;
        }

        const results: IntegrationStatus[] = [];

        // Test each known enabled integration
        for (const [name, integration] of Object.entries(integrations)) {
            // Skip unknown integrations (stale data)
            if (!knownIntegrations.includes(name)) continue;

            const intConfig = integration as { enabled?: boolean; url?: string; token?: string; apiKey?: string };

            if (!intConfig.enabled || !intConfig.url) {
                // Don't include disabled integrations
                continue;
            }

            const startTime = Date.now();
            try {
                const translatedUrl = translateHostUrl(intConfig.url);

                // Quick ping test based on integration type
                let testUrl = translatedUrl;
                const headers: Record<string, string> = {};

                if (name === 'plex' && intConfig.token) {
                    testUrl = `${translatedUrl}/`;
                    headers['X-Plex-Token'] = intConfig.token;
                } else if (['sonarr', 'radarr'].includes(name) && intConfig.apiKey) {
                    // Sonarr/Radarr v3 API
                    testUrl = `${translatedUrl}/api/v3/system/status`;
                    headers['X-Api-Key'] = intConfig.apiKey;
                } else if (name === 'overseerr' && intConfig.apiKey) {
                    // Overseerr uses v1 API
                    testUrl = `${translatedUrl}/api/v1/status`;
                    headers['X-Api-Key'] = intConfig.apiKey;
                } else if (name === 'qbittorrent') {
                    // qBittorrent - just check version endpoint
                    testUrl = `${translatedUrl}/api/v2/app/version`;
                } else if (name === 'systemstatus') {
                    testUrl = `${translatedUrl}/status`;
                    if (intConfig.token) headers['Authorization'] = `Bearer ${intConfig.token}`;
                }

                await axios.get(testUrl, {
                    headers,
                    httpsAgent,
                    timeout: 5000
                });

                results.push({
                    name,
                    enabled: true,
                    connected: true,
                    responseTime: Date.now() - startTime
                });
            } catch (error) {
                results.push({
                    name,
                    enabled: true,
                    connected: false,
                    responseTime: Date.now() - startTime,
                    error: (error as Error).message?.substring(0, 50)
                });
            }
        }

        const enabledCount = results.filter(r => r.enabled).length;
        const connectedCount = results.filter(r => r.connected).length;

        res.json({
            success: true,
            summary: `${connectedCount}/${enabledCount} integrations connected`,
            integrations: results
        });
    } catch (error) {
        logger.error(`[Diagnostics] Integration health check failed: error="${(error as Error).message}"`);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * SSE stream status
 */
router.get('/sse-status', async (req: Request, res: Response) => {
    try {
        const { getClientCount } = await import('../services/sseStreamService');
        const clientCount = getClientCount();

        res.json({
            success: true,
            status: clientCount > 0 ? 'active' : 'idle',
            connectedClients: clientCount
        });
    } catch (error) {
        logger.error(`[Diagnostics] SSE status check failed: error="${(error as Error).message}"`);
        res.json({
            success: false,
            status: 'error',
            error: (error as Error).message
        });
    }
});

/**
 * Test critical API endpoints (expanded with categories)
 */
router.get('/api-health', async (req: Request, res: Response) => {
    const baseURL = `http://localhost:${process.env.PORT || 3001}`;

    interface CategorizedEndpoint {
        category: string;
        name: string;
        path: string;
    }

    const endpoints: CategorizedEndpoint[] = [
        // Core APIs
        { category: 'Core', name: 'Health Check', path: '/api/health' },
        { category: 'Core', name: 'Setup Status', path: '/api/auth/setup/status' },
        { category: 'Core', name: 'App Config', path: '/api/config/app-name' },
        // Real-time
        { category: 'Real-time', name: 'SSE Endpoint', path: '/api/realtime/stream' }
    ];

    interface CategorizedResult extends EndpointResult {
        category: string;
    }

    const results: CategorizedResult[] = await Promise.all(endpoints.map(async (endpoint) => {
        const startTime = Date.now();

        try {
            // SSE endpoint just needs to connect, not fully stream
            if (endpoint.path.includes('stream')) {
                // Just check if endpoint responds
                await axios.get(`${baseURL}${endpoint.path}`, {
                    timeout: 2000,
                    headers: { 'Accept': 'text/event-stream' },
                    // Cancel immediately after headers received
                    validateStatus: () => true
                });
            } else {
                await axios.get(`${baseURL}${endpoint.path}`, {
                    timeout: 5000
                });
            }

            const responseTime = Date.now() - startTime;

            return {
                category: endpoint.category,
                name: endpoint.name,
                path: endpoint.path,
                status: 'healthy',
                responseTime
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            const axiosError = error as { code?: string; message?: string };

            return {
                category: endpoint.category,
                name: endpoint.name,
                path: endpoint.path,
                status: 'error',
                responseTime,
                error: axiosError.code || axiosError.message
            };
        }
    }));

    const allHealthy = results.every(r => r.status === 'healthy');

    // Group by category
    const grouped: Record<string, CategorizedResult[]> = {};
    for (const result of results) {
        if (!grouped[result.category]) grouped[result.category] = [];
        grouped[result.category].push(result);
    }

    res.json({
        success: true,
        overallStatus: allHealthy ? 'healthy' : 'degraded',
        categories: grouped,
        endpoints: results
    });
});

export default router;



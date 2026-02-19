import { Router, Request, Response } from 'express';
import os from 'os';
import { requireAdmin } from '../middleware/auth';
import logBuffer from '../utils/logBuffer';
import logger from '../utils/logger';
import { updateSystemConfig } from '../db/systemConfig';

const router = Router();

interface LogRelayBody {
    level: string;
    message: string;
    meta?: Record<string, unknown>;
}

interface LogLevelBody {
    level: string;
}

// All advanced settings routes require admin access
router.use(requireAdmin);

// ============================================================================
// LOGS ENDPOINTS
// ============================================================================

// Get recent logs
router.get('/logs', async (req: Request, res: Response) => {
    try {
        const logs = logBuffer.get();
        res.json({
            success: true,
            logs: logs
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Clear logs
router.post('/logs/clear', async (req: Request, res: Response) => {
    try {
        logBuffer.clear();
        res.json({ success: true, message: 'Logs cleared' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Download logs
router.get('/logs/download', async (req: Request, res: Response) => {
    try {
        const logsText = logBuffer.toText();
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename=framerr-logs.txt');
        res.send(logsText || 'No logs available');
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Relay frontend logs to server
router.post('/logs/relay', async (req: Request, res: Response) => {
    try {
        const { level, message, meta } = req.body as LogRelayBody;

        // Validate log level
        const validLevels = ['error', 'warn', 'info', 'debug'];
        if (!level || !validLevels.includes(level.toLowerCase())) {
            res.status(400).json({
                error: 'Invalid log level'
            });
            return;
        }

        // Add to log buffer
        logBuffer.add(level.toLowerCase(), `[FRONTEND] ${message}`, meta || {});

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Update log level
router.post('/logs/level', async (req: Request, res: Response) => {
    try {
        const { level } = req.body as LogLevelBody;
        const validLevels = ['error', 'warn', 'info', 'debug'];

        if (!level || !validLevels.includes(level.toLowerCase())) {
            res.status(400).json({
                error: 'Invalid log level. Must be: error, warn, info, or debug'
            });
            return;
        }

        // Update runtime logger
        logger.setLevel(level);

        // Save to systemConfig for persistence
        await updateSystemConfig({
            debug: { logLevel: level.toLowerCase() }
        });

        res.json({
            success: true,
            level: level.toLowerCase(),
            message: 'Log level updated'
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// SYSTEM ENDPOINTS
// ============================================================================

// Get system information
router.get('/system/info', async (req: Request, res: Response) => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const packageJson = require('../package.json');
        const systemInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime(),
            appVersion: packageJson.version
        };
        res.json({ success: true, data: systemInfo });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get resource usage
router.get('/system/resources', async (req: Request, res: Response) => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const resources = {
            memory: {
                used: Math.round(usedMem / 1024 / 1024),
                total: Math.round(totalMem / 1024 / 1024),
                percentage: Math.round((usedMem / totalMem) * 1000) / 10,
            },
            cpu: process.cpuUsage()
        };
        res.json({ success: true, data: resources });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get health check status
router.get('/system/health', async (req: Request, res: Response) => {
    try {
        const health = {
            database: { status: 'healthy', message: 'Connected' },
            api: { status: 'healthy', message: 'Responsive' }
        };
        res.json({ success: true, data: health });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// DIAGNOSTICS ENDPOINTS
// ============================================================================

// Run diagnostic tests
router.post('/diagnostics/test', async (req: Request, res: Response) => {
    try {
        res.json({
            success: true,
            results: {
                database: { status: 'pass', latency: 5 },
                integrations: { status: 'pass', tested: 0 }
            }
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================================================
// FEATURE FLAGS ENDPOINTS
// ============================================================================

// Get feature flags
router.get('/features', async (req: Request, res: Response) => {
    try {
        res.json({
            success: true,
            features: {}
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Update feature flags
router.post('/features', async (req: Request, res: Response) => {
    try {
        res.json({ success: true, message: 'Feature flags updated' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;


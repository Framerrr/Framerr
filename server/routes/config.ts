import { Router, Request, Response } from 'express';
import { getSystemConfig, updateSystemConfig } from '../db/systemConfig';
import { getUserConfig, updateUserConfig } from '../db/userConfig';
import { requireAuth, requireAdmin } from '../middleware/auth';
import logger from '../utils/logger';
import upload from '../middleware/upload';
import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';
import { createUserSession } from '../auth/session';
import { invalidateSystemSettings } from '../utils/invalidateUserSettings';

const router = Router();

// Use Express.Request directly - it's augmented in types/express.d.ts
// to include user?: User and proxyAuth?: boolean

// For multer file uploads
interface RequestWithFile extends Request {
    file?: Express.Multer.File;
}

interface FaviconBody {
    htmlSnippet: string;
}

interface FaviconToggleBody {
    enabled: boolean;
}

interface AuthBody {
    local?: { enabled?: boolean };
    proxy?: { enabled?: boolean };
    iframe?: { enabled?: boolean; endpoint?: string };
    session?: { timeout?: number };
}

/**
 * GET /api/config/system
 * Get system configuration (Admin only)
 */
router.get('/system', requireAdmin, async (req: Request, res: Response) => {
    try {
        const config = await getSystemConfig();
        res.json(config);
    } catch (error) {
        logger.error(`[Config] Failed to get system config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/config/system
 * Update system configuration (Admin only)
 */
router.put('/system', requireAdmin, async (req: Request, res: Response) => {
    try {
        const updatedConfig = await updateSystemConfig(req.body);

        // Broadcast to all users so they can refresh app-config (server name, icon, etc.)
        invalidateSystemSettings('app-config');

        logger.info(`[Config] System config updated: user=${req.user?.id} username="${req.user?.username}"`);

        res.json(updatedConfig);
    } catch (error) {
        logger.error(`[Config] Failed to update system config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/config/app-name
 * Get application branding (public, no auth required)
 */
router.get('/app-name', async (req: Request, res: Response) => {
    try {
        const config = await getSystemConfig();
        const serverConfig = config.server as unknown as Record<string, unknown>;
        res.json({
            name: config.server?.name || 'Framerr',
            icon: (serverConfig?.icon as string) || 'Server'
        });
    } catch (error) {
        logger.error(`[Config] Failed to get app name: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/config/web-push-status
 * Get Web Push enabled status
 */
router.get('/web-push-status', requireAuth, async (req: Request, res: Response) => {
    try {
        const config = await getSystemConfig();
        res.json({
            enabled: config.webPushEnabled !== false
        });
    } catch (error) {
        logger.error(`[Config] Failed to get web push status: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/config/user
 * Get current user's configuration
 */
router.get('/user', requireAuth, async (req: Request, res: Response) => {
    try {
        const config = await getUserConfig(req.user!.id);
        res.json(config);
    } catch (error) {
        logger.error(`[Config] Failed to get user config: user=${req.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/config/user
 * Update current user's configuration
 */
router.put('/user', requireAuth, async (req: Request, res: Response) => {
    try {
        const updatedConfig = await updateUserConfig(req.user!.id, req.body);

        logger.debug(`[Config] User config updated: user=${req.user!.id}`);

        res.json(updatedConfig);
    } catch (error) {
        logger.error(`[Config] Failed to update user config: user=${req.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/config/auth
 * Get authentication configuration (Admin only)
 */
router.get('/auth', requireAdmin, async (req: Request, res: Response) => {
    try {
        const config = await getSystemConfig();
        res.json(config.auth || {});
    } catch (error) {
        logger.error(`[Config] Failed to get auth config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/config/auth
 * Update authentication configuration (Admin only)
 */
router.put('/auth', requireAdmin, async (req: Request, res: Response) => {
    try {
        const body = req.body as AuthBody;

        // Validate iframe OAuth endpoint must be HTTPS
        if (body.iframe?.enabled && body.iframe?.endpoint) {
            try {
                const endpointUrl = new URL(body.iframe.endpoint);
                if (endpointUrl.protocol !== 'https:') {
                    res.status(400).json({
                        error: 'OAuth endpoint must use HTTPS for security'
                    });
                    return;
                }
            } catch {
                res.status(400).json({
                    error: 'Invalid OAuth endpoint URL format'
                });
                return;
            }
        }

        // Get current config to check if we're disabling proxy auth
        const currentConfig = await getSystemConfig();
        const wasProxyEnabled = currentConfig?.auth?.proxy?.enabled;
        const willProxyBeDisabled = !body.proxy?.enabled;

        // If disabling proxy auth while user is authenticated via proxy
        if (wasProxyEnabled && willProxyBeDisabled && req.proxyAuth) {
            logger.info(`[Config] Proxy auth disabled - creating local session: user=${req.user!.id} username="${req.user!.username}"`);

            // Create a session for the proxy-authenticated user
            const session = await createUserSession(
                req.user!,
                req,
                currentConfig.auth?.session?.timeout || 86400000
            );

            // Set session cookie
            res.cookie('sessionId', session.id, {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                maxAge: currentConfig.auth?.session?.timeout || 86400000
            });

            logger.info(`[Config] Local session created for proxy user: user=${req.user!.id} session=${session.id}`);
        }

        await updateSystemConfig({ auth: body as unknown } as Parameters<typeof updateSystemConfig>[0]);
        const config = await getSystemConfig();

        logger.info(`[Config] Auth config updated: user=${req.user?.id} username="${req.user?.username}"`);

        res.json(config.auth);
    } catch (error) {
        logger.error(`[Config] Failed to update auth config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/config/favicon
 * Upload favicon ZIP package (Admin only)
 */
router.post('/favicon', requireAdmin, upload.single('faviconZip'), async (req: Request, res: Response) => {
    try {
        const fileReq = req as RequestWithFile;
        if (!fileReq.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const { htmlSnippet } = req.body as FaviconBody;
        if (!htmlSnippet || typeof htmlSnippet !== 'string') {
            await fs.unlink(fileReq.file.path);
            res.status(400).json({ error: 'HTML snippet is required' });
            return;
        }

        const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
        const faviconDir = path.join(DATA_DIR, 'public/favicon');

        // Clean up old favicon files
        try {
            const files = await fs.readdir(faviconDir);
            await Promise.all(files.map(file => fs.unlink(path.join(faviconDir, file))));
        } catch {
            await fs.mkdir(faviconDir, { recursive: true });
        }

        // Extract ZIP to favicon directory
        const zip = new AdmZip(fileReq.file.path);
        zip.extractAllTo(faviconDir, true);

        // Clean up uploaded ZIP file
        await fs.unlink(fileReq.file.path);

        // Update system config with HTML snippet
        await updateSystemConfig({
            favicon: {
                enabled: true,
                htmlSnippet: htmlSnippet,
                uploadedAt: new Date().toISOString(),
                uploadedBy: req.user!.username
            } as import('../types/config').FaviconConfig
        });

        logger.info(`[Config] Favicon uploaded: user=${req.user!.id} username="${req.user!.username}"`);

        const updatedConfig = await getSystemConfig();
        res.json({
            success: true,
            message: 'Favicon uploaded successfully',
            favicon: updatedConfig.favicon
        });
    } catch (error) {
        const fileReq = req as RequestWithFile;
        logger.error(`[Config] Failed to upload favicon: error="${(error as Error).message}"`);

        if (fileReq.file) {
            try {
                await fs.unlink(fileReq.file.path);
            } catch {
                // Ignore cleanup errors
            }
        }

        res.status(500).json({ error: 'Failed to upload favicon: ' + (error as Error).message });
    }
});

/**
 * GET /api/config/favicon
 * Get current favicon configuration
 */
router.get('/favicon', async (req: Request, res: Response) => {
    try {
        const systemConfig = await getSystemConfig();
        const favicon = systemConfig.favicon || { htmlSnippet: null };
        res.json(favicon);
    } catch (error) {
        logger.error(`[Config] Failed to get favicon config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/config/favicon
 * Toggle custom favicon on/off (Admin only)
 */
router.patch('/favicon', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { enabled } = req.body as FaviconToggleBody;

        if (typeof enabled !== 'boolean') {
            res.status(400).json({ error: 'enabled must be a boolean' });
            return;
        }

        const systemConfig = await getSystemConfig();

        if (!systemConfig.favicon || !systemConfig.favicon.htmlSnippet) {
            res.status(400).json({ error: 'No custom favicon uploaded yet' });
            return;
        }

        await updateSystemConfig({
            favicon: {
                ...systemConfig.favicon,
                enabled: enabled
            }
        });

        logger.info(`[Config] Favicon ${enabled ? 'enabled' : 'disabled'}: user=${req.user?.id} username="${req.user?.username}"`);

        const updatedConfig = await getSystemConfig();
        res.json({
            success: true,
            message: `Custom favicon ${enabled ? 'enabled' : 'disabled'}`,
            favicon: updatedConfig.favicon
        });
    } catch (error) {
        logger.error(`[Config] Failed to toggle favicon: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to toggle favicon' });
    }
});

/**
 * DELETE /api/config/favicon
 * Reset favicon to default (Admin only)
 */
router.delete('/favicon', requireAdmin, async (req: Request, res: Response) => {
    try {
        const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
        const faviconDir = path.join(DATA_DIR, 'public/favicon');

        // Remove all favicon files
        try {
            const files = await fs.readdir(faviconDir);
            await Promise.all(files.map(file => fs.unlink(path.join(faviconDir, file))));
        } catch {
            // Directory might be empty
        }

        await updateSystemConfig({ favicon: undefined });

        logger.info(`[Config] Favicon reset: user=${req.user?.id} username="${req.user?.username}"`);

        res.json({ success: true, message: 'Favicon reset to default' });
    } catch (error) {
        logger.error(`[Config] Failed to reset favicon: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to reset favicon' });
    }
});

/**
 * GET /api/config/manifest.json
 * Dynamic PWA manifest
 */
router.get('/manifest.json', async (req: Request, res: Response) => {
    try {
        const systemConfig = await getSystemConfig();
        const appName = systemConfig.server?.name || 'Framerr';

        const manifest = {
            name: appName,
            short_name: appName,
            description: 'Your Personal Homelab Dashboard',
            start_url: '/',
            display: 'standalone',
            background_color: '#0a0a0b',
            theme_color: '#6366f1',
            orientation: 'any',
            icons: [
                { src: '/favicon/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: '/favicon/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
                { src: '/favicon/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: '/favicon/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
        };

        res.setHeader('Content-Type', 'application/manifest+json');
        res.json(manifest);
    } catch (error) {
        logger.error(`[Config] Failed to generate manifest: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;


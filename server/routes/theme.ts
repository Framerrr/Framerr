import { Router, Request, Response } from 'express';
import { getUserConfig, updateUserConfig, ThemeConfig } from '../db/userConfig';
import { getSystemConfig, updateSystemConfig } from '../db/systemConfig';
import { requireAuth } from '../middleware/auth';
import { broadcastToUser } from '../services/sseStreamService';
import logger from '../utils/logger';

const router = Router();

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

interface ThemeBody {
    theme: Partial<ThemeConfig>;
}

/**
 * GET /api/theme/default
 * Get the login page theme (public - no auth required)
 * Reads from system config loginTheme (auto-synced when admin changes theme)
 */
router.get('/default', async (req: Request, res: Response) => {
    try {
        const config = await getSystemConfig();
        res.json({ theme: config.loginTheme || 'dark-pro' });
    } catch (error) {
        logger.error(`[Theme] Failed to get default: error="${(error as Error).message}"`);
        res.json({ theme: 'dark-pro' });
    }
});

/**
 * GET /api/theme
 * Get current user's theme preferences
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userConfig = await getUserConfig(authReq.user!.id);
        const theme = userConfig.theme || {
            mode: 'system',
            primaryColor: '#3b82f6',
            preset: 'default'
        };

        res.json({ theme });
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Theme] Failed to get: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch theme' });
    }
});

/**
 * PUT /api/theme
 * Update current user's theme preferences
 */
router.put('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { theme } = req.body as ThemeBody;

        // Validate theme object
        if (!theme || typeof theme !== 'object') {
            res.status(400).json({ error: 'Theme must be an object' });
            return;
        }

        // Validate mode if provided
        if (theme.mode && !['light', 'dark', 'system'].includes(theme.mode)) {
            res.status(400).json({
                error: 'Theme mode must be one of: light, dark, system'
            });
            return;
        }

        // Validate primaryColor if provided
        if (theme.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(theme.primaryColor)) {
            res.status(400).json({
                error: 'Primary color must be a valid hex color (e.g., #3b82f6)'
            });
            return;
        }

        // Get current config
        const userConfig = await getUserConfig(authReq.user!.id);

        // Merge theme settings
        const updatedTheme = {
            ...userConfig.theme,
            ...theme
        };

        // Save to user config
        await updateUserConfig(authReq.user!.id, {
            theme: updatedTheme
        });

        logger.debug(`[Theme] Updated: user=${authReq.user!.id} preset=${updatedTheme.preset}`);

        // Auto-sync loginTheme when an admin changes their theme
        if (authReq.user!.group === 'admin' && updatedTheme.preset) {
            try {
                await updateSystemConfig({ loginTheme: updatedTheme.preset });
                logger.debug(`[Theme] Login theme synced: ${updatedTheme.preset}`);
            } catch (syncErr) {
                logger.warn(`[Theme] Failed to sync login theme: ${(syncErr as Error).message}`);
            }
        }

        // SSE: Broadcast theme change to all user's connected sessions
        broadcastToUser(authReq.user!.id, 'settings:theme', {
            action: 'updated',
            theme: updatedTheme
        });

        res.json({
            success: true,
            theme: updatedTheme
        });

    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Theme] Failed to update: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to save theme' });
    }
});

/**
 * POST /api/theme/reset
 * Reset current user's theme to defaults
 */
router.post('/reset', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const defaultTheme = {
            mode: 'system' as const,
            primaryColor: '#3b82f6',
            preset: 'default'
        };

        await updateUserConfig(authReq.user!.id, {
            theme: defaultTheme
        });

        logger.debug(`[Theme] Reset: user=${authReq.user!.id}`);

        // SSE: Broadcast theme reset to all user's connected sessions
        broadcastToUser(authReq.user!.id, 'settings:theme', {
            action: 'reset',
            theme: defaultTheme
        });

        res.json({
            success: true,
            theme: defaultTheme
        });

    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Theme] Failed to reset: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to reset theme' });
    }
});

export default router;


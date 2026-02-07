import { Router, Request, Response } from 'express';
import { getUserConfig, updateUserConfig, ThemeConfig } from '../db/userConfig';
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
 * Get the default/admin theme (public - no auth required)
 * Used for login page theming
 */
router.get('/default', async (req: Request, res: Response) => {
    try {
        // Get the first admin user to use their theme as default
        const { getDb } = await import('../database/db');
        const db = getDb();
        const adminUser = db.prepare(`
            SELECT id FROM users WHERE group_id = 'admin' LIMIT 1
        `).get() as { id: string } | undefined;

        if (adminUser) {
            const userConfig = await getUserConfig(adminUser.id);
            const themeConfig = userConfig.theme;

            // Check for preset (set when user changes theme via UI)
            if (themeConfig?.preset) {
                res.json({ theme: themeConfig.preset });
                return;
            }

            // Check raw theme_config in database
            const rawConfig = db.prepare(`
                SELECT theme_config FROM user_preferences WHERE user_id = ?
            `).get(adminUser.id) as { theme_config: string | null } | undefined;

            if (rawConfig?.theme_config) {
                try {
                    const parsed = JSON.parse(rawConfig.theme_config);
                    if (parsed.preset) {
                        res.json({ theme: parsed.preset });
                        return;
                    }
                } catch {
                    // Parse error - continue to default
                }
            }
        }

        // Default fallback
        res.json({ theme: 'dark-pro' });
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


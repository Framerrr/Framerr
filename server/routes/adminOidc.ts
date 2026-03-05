/**
 * Admin OIDC Configuration Routes
 * 
 * Admin-only endpoints for managing OpenID Connect SSO settings.
 * Client secret is encrypted at rest and redacted in API responses.
 */
import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth';
import { getOidcConfigRedacted, updateOidcConfig } from '../db/oidcConfig';
import { testDiscovery, clearCache } from '../auth/oidcClient';
import { invalidateSystemSettings } from '../utils/invalidateUserSettings';
import logger from '../utils/logger';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface OidcConfigUpdateBody {
    enabled?: boolean;
    issuerUrl?: string;
    clientId?: string;
    clientSecret?: string;
    displayName?: string;
    scopes?: string;
    autoCreateUsers?: boolean;
}

interface TestDiscoveryBody {
    issuerUrl: string;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/admin/oidc
 * Get OIDC configuration (client secret redacted)
 */
router.get('/', requireAdmin, (_req: Request, res: Response): void => {
    try {
        const config = getOidcConfigRedacted();
        res.json(config);
    } catch (error) {
        logger.error(`[AdminOIDC] Failed to get config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get OIDC configuration' });
    }
});

/**
 * PUT /api/admin/oidc
 * Update OIDC configuration
 */
router.put('/', requireAdmin, (req: Request, res: Response): void => {
    try {
        const body = req.body as OidcConfigUpdateBody;

        // Validate issuer URL format if provided
        if (body.issuerUrl !== undefined && body.issuerUrl !== '') {
            try {
                new URL(body.issuerUrl);
            } catch {
                res.status(400).json({ error: 'Invalid issuer URL format' });
                return;
            }
        }

        // Validate scopes if provided
        if (body.scopes !== undefined && body.scopes !== '') {
            if (!body.scopes.includes('openid')) {
                res.status(400).json({ error: 'Scopes must include "openid"' });
                return;
            }
        }

        const updated = updateOidcConfig(body);

        // Clear cached OIDC client configuration so next request re-discovers
        clearCache();

        logger.info(`[AdminOIDC] Config updated: enabled=${updated.enabled}`);

        // Broadcast SSO config change to all connected clients
        invalidateSystemSettings('sso-config');

        // Return redacted version
        const redacted = getOidcConfigRedacted();
        res.json(redacted);
    } catch (error) {
        logger.error(`[AdminOIDC] Failed to update config: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update OIDC configuration' });
    }
});

/**
 * POST /api/admin/oidc/test
 * Test OIDC discovery for a given issuer URL
 */
router.post('/test', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { issuerUrl } = req.body as TestDiscoveryBody;

        if (!issuerUrl) {
            res.status(400).json({ error: 'Issuer URL is required' });
            return;
        }

        // Validate URL format
        try {
            new URL(issuerUrl);
        } catch {
            res.status(400).json({ error: 'Invalid issuer URL format' });
            return;
        }

        const result = await testDiscovery(issuerUrl);
        res.json(result);
    } catch (error) {
        logger.error(`[AdminOIDC] Discovery test error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Discovery test failed' });
    }
});

export default router;

/**
 * Walkthrough Routes
 * 
 * Manages walkthrough flow completion status per user.
 * Supports multiple named flows (onboarding, what's-new, etc.).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getWalkthroughFlows, setWalkthroughFlowCompleted, resetAllWalkthroughFlows } from '../db/users/crud';
import logger from '../utils/logger';

const router = Router();

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & {
    user?: AuthenticatedUser;
};

const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    next();
};

/**
 * GET /api/walkthrough/status
 * Returns completion status for all flows
 */
router.get('/status', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const flows = getWalkthroughFlows(authReq.user!.id);
        res.json({ flows });
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Walkthrough] Failed to get status: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get walkthrough status' });
    }
});

/**
 * POST /api/walkthrough/complete
 * Mark a specific flow as completed
 * Body: { flowId: string }
 */
router.post('/complete', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { flowId } = req.body as { flowId: string };

        if (!flowId || typeof flowId !== 'string') {
            res.status(400).json({ error: 'flowId is required' });
            return;
        }

        setWalkthroughFlowCompleted(authReq.user!.id, flowId, true);
        res.json({ success: true });
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Walkthrough] Failed to complete flow: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to complete walkthrough flow' });
    }
});

/**
 * POST /api/walkthrough/reset
 * Reset a specific flow or all flows
 * Body: { flowId?: string } — omit flowId to reset all
 */
router.post('/reset', requireAuth, (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { flowId } = req.body as { flowId?: string };

        if (flowId) {
            setWalkthroughFlowCompleted(authReq.user!.id, flowId, false);
        } else {
            resetAllWalkthroughFlows(authReq.user!.id);
        }

        res.json({ success: true });
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Walkthrough] Failed to reset flow: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to reset walkthrough flow' });
    }
});

export default router;

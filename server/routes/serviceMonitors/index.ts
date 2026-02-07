/**
 * Service Monitors API Routes
 * 
 * REST API for service monitoring CRUD, status, and history.
 * 
 * IMPORTANT: Route order matters! Static routes (/shared, /config, /test)
 * must be defined BEFORE parameterized routes (/:id).
 * 
 * Endpoints:
 * - GET / - Get all monitors (admin)
 * - POST / - Create monitor (admin)
 * - POST /test - Test config (admin)
 * - GET /config - Get config (admin)
 * - PUT /config - Update config (admin)
 * - PUT /reorder - Reorder monitors (admin)
 * - GET /shared - Get shared monitors (user)
 * - GET /poller/status - Get poller status (admin)
 * - PUT /:id - Update monitor (admin)
 * - DELETE /:id - Delete monitor (admin)
 * - POST /:id/test - Test saved monitor (admin)
 * - POST /:id/maintenance - Toggle maintenance (admin)
 * - GET /:id/shares - Get shares (admin)
 * - POST /:id/share - Share monitor (admin)
 * - DELETE /:id/share - Revoke shares (admin)
 * - GET /:id/status - Get status (user)
 * - GET /:id/history - Get history (user)
 * - GET /:id/aggregates - Get aggregates (user)
 */
import { Router } from 'express';
import configRouter, { isConfigured } from './config';
import adminRouter from './admin';
import actionsRouter from './actions';
import sharingRouter from './sharing';
import userRouter from './user';

const router = Router();

// Mount config routes first (static paths)
router.use('/config', configRouter);

// Mount static user routes BEFORE parameterized routes
// /shared and /poller/status must be accessible before /:id matching
router.get('/shared', (req, res, next) => userRouter(req, res, next));
router.get('/poller/status', (req, res, next) => userRouter(req, res, next));

// Mount admin CRUD (includes /, /test, /reorder, /:id)
router.use('/', adminRouter);

// Mount actions (/:id/maintenance)
router.use('/', actionsRouter);

// Mount sharing (/:id/shares, /:id/share)
router.use('/', sharingRouter);

// Mount user routes (/:id/status, /:id/history, /:id/aggregates)
router.use('/', userRouter);

export default router;

// Re-export isConfigured for external use
export { isConfigured };

// Re-export types
export * from './types';

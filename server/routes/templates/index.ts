/**
 * Template Routes
 * 
 * API endpoints for dashboard template management.
 * 
 * IMPORTANT: Route order matters! Specific routes (categories, backup, revert, draft)
 * must be defined BEFORE parameterized routes (/:id) to prevent Express from
 * matching them as template IDs.
 * 
 * Endpoints:
 * - /categories/* - Category CRUD
 * - /draft - Save draft
 * - / - Template CRUD
 * - /:id/apply - Apply template
 * - /:id/sync - Sync shared copy
 * - /:id/shares - Get shares
 * - /:id/share - Share template
 * - /:id/set-default - Set as default
 */
import { Router } from 'express';
import categoriesRouter from './categories';
import crudRouter from './crud';
import operationsRouter from './operations';
import sharingRouter from './sharing';

const router = Router();

// Mount specific routes BEFORE parameterized routes
router.use('/categories', categoriesRouter);

// Draft route - needs to be before CRUD to prevent /:id matching 'draft'
import draftRouter from './draft';
router.use('/draft', draftRouter);

// Mount CRUD at root - this handles /, /:id, etc.
// Note: Express will route more specific paths first
router.use('/', crudRouter);

// Mount operations and sharing - these handle /:id/action routes
router.use('/', operationsRouter);
router.use('/', sharingRouter);

export default router;

// Re-export types for consumers
export * from './types';

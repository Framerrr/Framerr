/**
 * Backup Routes — Barrel
 *
 * Composes all backup sub-routers into a single router.
 * Import path from server/index.ts is unchanged: './routes/backup' →
 * TypeScript auto-resolves to this index.ts.
 */

import { Router } from 'express';
import archiveRouter from './archive';
import scheduleRouter from './schedule';
import userExportImportRouter from './userExportImport';
import encryptionRouter from './encryption';

const router = Router();

// Mount order: all sub-routers use '/' prefix.
// Route collision analysis:
//   - archiveRouter: /create, /list, /download/:filename, /status, /:filename (DELETE)
//   - scheduleRouter: /schedule (GET/PUT)
//   - userExportImportRouter: /export, /import, /system
//   - encryptionRouter: /encryption/* (multi-segment, never collides with /:filename)
// The only parameterized route (DELETE /:filename) is defined LAST within archiveRouter,
// but Express matches by HTTP method + path specificity, so /schedule, /export, etc.
// are all more specific than /:filename (they are literal strings vs parameter).
// This matches the original file's route definition order.
router.use('/', archiveRouter);
router.use('/', scheduleRouter);
router.use('/', userExportImportRouter);
router.use('/', encryptionRouter);

export default router;

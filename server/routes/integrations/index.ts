/**
 * Integration Routes
 * 
 * REST API for managing integration instances.
 * 
 * Structure:
 * - _core/         Core routes (CRUD, test, schemas)
 * - plex/          Plex-specific routes
 * - overseerr/     Overseerr-specific routes
 * - sonarr/        Sonarr-specific routes
 * - radarr/        Radarr-specific routes
 * - qbittorrent/   qBittorrent-specific routes
 * - glances/       Glances-specific routes
 * - customsystemstatus/  Custom System Status routes
 * - uptimekuma/    Uptime Kuma-specific routes
 * - monitor/       Framerr Monitor routes
 * 
 * Endpoints:
 * - GET /api/integrations - Get all instances (admin)
 * - GET /api/integrations/schemas - Get plugin schemas
 * - GET /api/integrations/:id/proxy/* - Integration-specific proxy endpoints
 * - GET /api/integrations/:id/servers - Overseerr server discovery
 * - POST /api/integrations/:id/actions/* - Overseerr approve/decline
 * - POST /api/integrations/test - Test with config (admin)
 * - POST /api/integrations/:id/test - Test saved instance (admin)
 */
import { Router } from 'express';

// Import core routers from _core folder
import { crudRouter, testRouter, schemasRouter } from './_core';

// Import proxy routers from each integration
import { plexProxyRouter } from './plex';
import { sonarrProxyRouter } from './sonarr';
import { radarrProxyRouter } from './radarr';
import { qbittorrentProxyRouter } from './qbittorrent';
import { overseerrProxyRouter, overseerrActionsRouter, overseerrServersRouter } from './overseerr';
import { glancesProxyRouter } from './glances';
import { customsystemstatusProxyRouter } from './customsystemstatus';
import { uptimekumaProxyRouter } from './uptimekuma';
import { proxyRouter as monitorProxyRouter } from './monitor';
import { jellyfinProxyRouter } from './jellyfin';
import { embyProxyRouter } from './emby';
import { tautulliProxyRouter } from './tautulli';
import { sabnzbdProxyRouter } from './sabnzbd';


const router = Router();


// Mount schemas endpoint (before parameterized routes)
router.use('/', schemasRouter);

// =============================================================================
// IMPORTANT: Proxy routes must come BEFORE CRUD routes!
// The CRUD router has /:id which would catch /:id/proxy/* requests first.
// More specific routes (/:id/proxy/*) must be registered before less specific (/:id)
// =============================================================================

// Mount proxy routers - these handle /:id/proxy/* routes
router.use('/', plexProxyRouter);
router.use('/', sonarrProxyRouter);
router.use('/', radarrProxyRouter);
router.use('/', qbittorrentProxyRouter);
router.use('/', overseerrProxyRouter);
router.use('/', glancesProxyRouter);
router.use('/', customsystemstatusProxyRouter);
router.use('/', uptimekumaProxyRouter);
router.use('/', monitorProxyRouter);
router.use('/', jellyfinProxyRouter);
router.use('/', embyProxyRouter);
router.use('/', tautulliProxyRouter);
router.use('/', sabnzbdProxyRouter);

// Overseerr-specific: actions and server discovery
router.use('/', overseerrActionsRouter);
router.use('/', overseerrServersRouter);

// Mount CRUD operations (includes /shared before /:id per route order)
// NOTE: This must come AFTER proxy routes since it has /:id catch-all
router.use('/', crudRouter);

// Mount test endpoints from new modular structure
router.use('/', testRouter);

export default router;

// Re-export types for consumers
export * from './_core/types';

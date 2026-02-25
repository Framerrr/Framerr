/**
 * qBittorrent Integration Plugin
 *
 * Self-contained integration for qBittorrent torrent client.
 * Implements the IntegrationPlugin interface for auto-discovery.
 * 
 * Notable: Uses stateful cookie-based authentication with:
 * - Cookie caching per instance (5-minute TTL)
 * - Login locks to prevent simultaneous auth attempts
 * - Automatic cache invalidation on 401/403 with retry
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { QBittorrentAdapter } from './adapter';
import * as poller from './poller';

const adapter = new QBittorrentAdapter();

export const plugin: IntegrationPlugin = {
    id,
    name,
    description,
    category,
    icon,
    configSchema,
    adapter,
    testConnection: adapter.testConnection.bind(adapter),
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
};

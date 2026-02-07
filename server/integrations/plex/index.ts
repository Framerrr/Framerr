/**
 * Plex Integration Plugin
 *
 * Self-contained integration for Plex Media Server.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema, connectionFields } from './config';
import { PlexAdapter } from './adapter';
import { testConnection } from './test';
import * as poller from './poller';
import { realtime } from './realtime';

export const plugin: IntegrationPlugin = {
    id,
    name,
    description,
    category,
    icon,
    configSchema,
    connectionFields,
    adapter: new PlexAdapter(),
    testConnection,
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
    realtime,
};

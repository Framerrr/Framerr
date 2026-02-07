/**
 * Emby Integration Plugin
 *
 * Self-contained integration for Emby Media Server.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema, connectionFields } from './config';
import { EmbyAdapter } from './adapter';
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
    adapter: new EmbyAdapter(),
    testConnection,
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
    realtime,
};

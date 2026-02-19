/**
 * SABnzbd Integration Plugin
 *
 * Self-contained integration for SABnzbd Usenet client.
 * Implements the IntegrationPlugin interface for auto-discovery.
 * 
 * Notable: Uses simple API key query param authentication —
 * no sessions, no cookies, no locks needed.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { SABnzbdAdapter } from './adapter';
import { testConnection } from './test';
import * as poller from './poller';

export const plugin: IntegrationPlugin = {
    id,
    name,
    description,
    category,
    icon,
    configSchema,
    adapter: new SABnzbdAdapter(),
    testConnection,
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
};

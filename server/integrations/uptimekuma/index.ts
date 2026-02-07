/**
 * Uptime Kuma Integration Plugin
 *
 * Self-contained integration for Uptime Kuma monitoring.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { UptimeKumaAdapter } from './adapter';
import { testConnection } from './test';
import * as poller from './poller';

export const plugin: IntegrationPlugin = {
    id,
    name,
    description,
    category,
    icon,
    configSchema,
    adapter: new UptimeKumaAdapter(),
    testConnection,
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
};


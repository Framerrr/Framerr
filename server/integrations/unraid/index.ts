/**
 * Unraid Integration Plugin
 *
 * Self-contained integration for Unraid server monitoring.
 * Implements the IntegrationPlugin interface for auto-discovery.
 *
 * Requires Unraid 7.2+ (built-in GraphQL API) or the Unraid Connect plugin.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { UnraidAdapter } from './adapter';
import { testConnection } from './test';
import * as poller from './poller';

export const plugin: IntegrationPlugin = {
    id,
    name,
    description,
    category,
    icon,
    configSchema,
    adapter: new UnraidAdapter(),
    testConnection,
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
    metrics: [
        { key: 'cpu', recordable: true },
        { key: 'memory', recordable: true },
        { key: 'diskUsage', recordable: false },
        { key: 'uptime', recordable: false },
    ],
};

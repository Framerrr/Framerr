/**
 * Custom System Status Integration Plugin
 *
 * Self-contained integration for user's own system monitoring API.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { CustomSystemStatusAdapter } from './adapter';
import { testConnection } from './test';
import * as poller from './poller';

export const plugin: IntegrationPlugin = {
    id,
    name,
    description,
    category,
    icon,
    configSchema,
    adapter: new CustomSystemStatusAdapter(),
    testConnection,
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
    metrics: [
        { key: 'cpu', recordable: true, historyProbe: { path: '/history', params: { metric: 'cpu', range: '1h' } } },
        { key: 'memory', recordable: true, historyProbe: { path: '/history', params: { metric: 'memory', range: '1h' } } },
        { key: 'temperature', recordable: true, historyProbe: { path: '/history', params: { metric: 'temperature', range: '1h' } } },
        { key: 'uptime', recordable: false },
    ],
};

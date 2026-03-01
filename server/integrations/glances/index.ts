/**
 * Glances Integration Plugin
 *
 * Self-contained integration for Glances system monitoring.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { GlancesAdapter } from './adapter';
import * as poller from './poller';

const adapter = new GlancesAdapter();

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
    metrics: [
        { key: 'cpu', recordable: true },
        { key: 'memory', recordable: true },
        { key: 'temperature', recordable: true },
        { key: 'diskUsage', recordable: false },
        { key: 'uptime', recordable: false },
        { key: 'networkUp', recordable: false },
        { key: 'networkDown', recordable: false },
    ],
};

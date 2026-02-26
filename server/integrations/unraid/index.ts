/**
 * Unraid Integration Plugin
 *
 * Self-contained integration for Unraid server monitoring via GraphQL API.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { UnraidAdapter } from './adapter';
import * as poller from './poller';

const adapter = new UnraidAdapter();

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
        { key: 'uptime', recordable: false },
        { key: 'diskUsage', recordable: false },
        // networkUp/networkDown: not available via Unraid GraphQL API
    ],
};

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
};

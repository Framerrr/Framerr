/**
 * Framerr Monitor Integration Plugin
 *
 * Self-contained integration for Framerr's first-party service monitoring.
 * Implements the IntegrationPlugin interface for auto-discovery.
 * 
 * Unlike external integrations, this uses local database storage for monitors.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { MonitorAdapter } from './adapter';
import { testConnection } from './test';
import * as poller from './poller';

export const plugin: IntegrationPlugin = {
    id,
    name,
    description,
    category,
    icon,
    configSchema,
    adapter: new MonitorAdapter(),
    testConnection,
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
};

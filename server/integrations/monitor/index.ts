/**
 * Framerr Monitor Integration Plugin
 *
 * Self-contained integration for Framerr's first-party service monitoring.
 * Implements the IntegrationPlugin interface for auto-discovery.
 * 
 * Unlike external integrations, this uses local database storage for monitors.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema, notificationEvents } from './config';
import { MonitorAdapter } from './adapter';
import * as poller from './poller';

const adapter = new MonitorAdapter();

export const plugin: IntegrationPlugin = {
    id,
    name,
    description,
    category,
    icon,
    configSchema,
    notificationMode: 'local',
    notificationEvents,
    adapter,
    testConnection: adapter.testConnection.bind(adapter),
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
};

/**
 * Overseerr Integration Plugin
 *
 * Self-contained integration for Overseerr media request management.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { OverseerrAdapter } from './adapter';
import * as poller from './poller';
import { webhook } from './webhook';

const adapter = new OverseerrAdapter();

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
    webhook,
    notificationMode: 'webhook',
};

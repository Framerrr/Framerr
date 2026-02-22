/**
 * Radarr Integration Plugin
 *
 * Self-contained integration for Radarr movie management.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { RadarrAdapter } from './adapter';
import { testConnection } from './test';
import * as poller from './poller';
import { webhook } from './webhook';

export const plugin: IntegrationPlugin = {
    id,
    name,
    description,
    category,
    icon,
    configSchema,
    adapter: new RadarrAdapter(),
    testConnection,
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
        subtypes: poller.subtypes,
    },
    webhook,
    notificationMode: 'webhook',
};

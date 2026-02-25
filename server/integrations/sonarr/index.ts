/**
 * Sonarr Integration Plugin
 *
 * Self-contained integration for Sonarr TV show management.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { SonarrAdapter } from './adapter';
import * as poller from './poller';
import { webhook } from './webhook';

const adapter = new SonarrAdapter();

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
        subtypes: poller.subtypes,
    },
    webhook,
    notificationMode: 'webhook',
};

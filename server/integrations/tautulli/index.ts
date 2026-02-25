/**
 * Tautulli Integration Plugin
 *
 * Self-contained integration for Tautulli media monitoring.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { TautulliAdapter } from './adapter';
import * as poller from './poller';

const adapter = new TautulliAdapter();

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
};

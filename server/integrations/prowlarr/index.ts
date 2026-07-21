/**
 * Prowlarr Integration Plugin
 *
 * Self-contained integration for Prowlarr indexer management.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { ProwlarrAdapter } from './adapter';
import * as poller from './poller';

const adapter = new ProwlarrAdapter();

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

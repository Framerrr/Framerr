/**
 * Overseerr Integration Plugin
 *
 * Self-contained integration for Overseerr media request management.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { OverseerrAdapter } from './adapter';
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
    adapter: new OverseerrAdapter(),
    testConnection,
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
    webhook,
};

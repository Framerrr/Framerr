/**
 * SABnzbd Integration Plugin
 *
 * Self-contained integration for SABnzbd usenet download management.
 * Implements the IntegrationPlugin interface for auto-discovery.
 */

import { IntegrationPlugin } from '../types';
import { id, name, description, category, icon, configSchema } from './config';
import { SABnzbdAdapter } from './adapter';
import * as poller from './poller';

const adapter = new SABnzbdAdapter();

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
};

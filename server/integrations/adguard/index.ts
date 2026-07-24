import { IntegrationPlugin } from '../types';
import * as config from './config';
import { AdGuardAdapter } from './adapter';
import * as poller from './poller';

const adapter = new AdGuardAdapter();

export const plugin: IntegrationPlugin = {
    ...config,
    adapter,
    testConnection: adapter.testConnection.bind(adapter),
    poller: {
        intervalMs: poller.intervalMs,
        poll: poller.poll,
    },
};

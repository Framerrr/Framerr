import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// MONITOR (FRAMERR FIRST-PARTY) PLUGIN METADATA
// ============================================================================

export const id = 'monitor';
export const name = 'Framerr Monitor';
export const description = 'First-party service monitoring with customizable health checks';
export const category: IntegrationCategory = 'system';
export const icon = 'system:framerr';


// No external config required - monitors are stored in local database
export const configSchema: ConfigSchema = {
    fields: [],
    infoMessage: {
        icon: 'info',
        title: 'Built-in Monitoring',
        content: 'This integration uses Framerr\'s built-in service monitoring. Monitors are configured per-widget after adding this integration.',
    },
};

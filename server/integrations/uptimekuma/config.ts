import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// UPTIME KUMA PLUGIN METADATA
// ============================================================================

export const id = 'uptimekuma';
export const name = 'Uptime Kuma';
export const description = 'Self-hosted uptime monitoring';
export const category: IntegrationCategory = 'system';
export const icon = 'system:uptime-kuma';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Uptime Kuma URL',
            placeholder: 'http://192.168.1.5:3001',
            required: true,
        },
        {
            key: 'apiKey',
            type: 'password',
            label: 'API Key',
            placeholder: 'Your Uptime Kuma API key',
            required: true,
        },
    ],
    infoMessage: {
        icon: 'info',
        title: 'API Key Setup',
        content: 'Generate an API key in Uptime Kuma under Settings → API Keys. The /metrics endpoint must be enabled.',
    },
};

import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// TAUTULLI PLUGIN METADATA
// ============================================================================

export const id = 'tautulli';
export const name = 'Tautulli';
export const description = 'Monitor and track Plex Media Server usage and statistics';
export const category: IntegrationCategory = 'media';
export const icon = 'system:tautulli';

export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Tautulli URL',
            placeholder: 'http://192.168.1.5:8181',
            required: true,
        },
        {
            key: 'apiKey',
            type: 'text',
            sensitive: true,
            label: 'API Key',
            placeholder: 'Your Tautulli API key',
            required: true,
        },
    ],
};

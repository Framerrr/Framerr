import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// SONARR PLUGIN METADATA
// ============================================================================

export const id = 'sonarr';
export const name = 'Sonarr';
export const description = 'Automatically download and manage TV shows';
export const category: IntegrationCategory = 'management';
export const icon = 'system:sonarr';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Sonarr URL',
            placeholder: 'http://192.168.1.5:8989',
            required: true,
        },
        {
            key: 'apiKey',
            type: 'password',
            label: 'API Key',
            placeholder: 'Your Sonarr API key',
            required: true,
        },
    ],
};

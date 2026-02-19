import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// RADARR PLUGIN METADATA
// ============================================================================

export const id = 'radarr';
export const name = 'Radarr';
export const description = 'Automatically download and manage movies';
export const category: IntegrationCategory = 'management';
export const icon = 'system:radarr';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Radarr URL',
            placeholder: 'http://192.168.1.5:7878',
            required: true,
        },
        {
            key: 'apiKey',
            type: 'text',
            sensitive: true,
            label: 'API Key',
            placeholder: 'Your Radarr API key',
            required: true,
        },
    ],
};

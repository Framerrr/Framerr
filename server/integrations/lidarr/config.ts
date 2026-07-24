import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// LIDARR PLUGIN METADATA
// ============================================================================

export const id = 'lidarr';
export const name = 'Lidarr';
export const description = 'Automatically download and manage music';
export const category: IntegrationCategory = 'management';
export const icon = 'system:lidarr';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Lidarr URL',
            placeholder: 'http://192.168.1.5:8686',
            required: true,
        },
        {
            key: 'apiKey',
            type: 'text',
            sensitive: true,
            label: 'API Key',
            placeholder: 'Your Lidarr API key',
            required: true,
        },
    ],
};

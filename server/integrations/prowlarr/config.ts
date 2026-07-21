import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// PROWLARR PLUGIN METADATA
// ============================================================================

export const id = 'prowlarr';
export const name = 'Prowlarr';
export const description = 'Indexer manager for torrent and usenet';
export const category: IntegrationCategory = 'management';
export const icon = 'system:prowlarr';

export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Prowlarr URL',
            placeholder: 'http://192.168.1.5:9696',
            required: true,
        },
        {
            key: 'apiKey',
            type: 'text',
            sensitive: true,
            label: 'API Key',
            placeholder: 'Your Prowlarr API key',
            required: true,
        },
    ],
};

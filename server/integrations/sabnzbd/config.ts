import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// SABNZBD PLUGIN METADATA
// ============================================================================

export const id = 'sabnzbd';
export const name = 'SABnzbd';
export const description = 'Free and open-source Usenet binary newsreader';
export const category: IntegrationCategory = 'media';
export const icon = 'system:sabnzbd';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'SABnzbd URL',
            placeholder: 'http://192.168.1.100:8080',
            hint: 'URL to your SABnzbd web interface',
            required: true,
        },
        {
            key: 'apiKey',
            type: 'text',
            sensitive: true,
            label: 'API Key',
            placeholder: 'Your SABnzbd API key',
            hint: 'Found in SABnzbd → Config → General → API Key',
            required: true,
        },
    ],
};

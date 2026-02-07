import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// EMBY PLUGIN METADATA
// ============================================================================

export const id = 'emby';
export const name = 'Emby';
export const description = 'Personal media server for movies, TV shows, and music';
export const category: IntegrationCategory = 'media';
export const icon = 'system:emby';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Emby URL',
            placeholder: 'http://192.168.1.100:8096',
            required: true,
        },
        {
            key: 'apiKey',
            type: 'password',
            label: 'API Key',
            placeholder: 'Your Emby API key',
            hint: 'Generate in Settings → Advanced → API Keys',
            required: true,
        },
        {
            key: 'userId',
            type: 'text',
            label: 'User ID',
            placeholder: 'User ID for session access',
            hint: 'Found in Settings → Users → User → Copy ID',
            required: true,
        },
        {
            key: 'webUrl',
            type: 'url',
            label: 'Web Interface URL',
            placeholder: '(Same as Emby URL)',
            hint: 'URL for "Open in Emby" links. Leave empty to use the server URL above.',
            required: false,
        },
    ],
};

/**
 * Config fields that require connection refresh when changed.
 * Changes to other fields (librarySyncEnabled, webUrl) won't trigger reconnection.
 */
export const connectionFields = ['url', 'apiKey', 'userId'];

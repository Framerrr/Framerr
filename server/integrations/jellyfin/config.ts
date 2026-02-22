import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// JELLYFIN PLUGIN METADATA
// ============================================================================

export const id = 'jellyfin';
export const name = 'Jellyfin';
export const description = 'Free software media system for movies, TV shows, and music';
export const category: IntegrationCategory = 'media';
export const icon = 'system:jellyfin';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Jellyfin URL',
            placeholder: 'http://192.168.1.100:8096',
            required: true,
        },
        {
            key: 'apiKey',
            type: 'text',
            sensitive: true,
            label: 'API Key',
            placeholder: 'Your Jellyfin API key',
            hint: 'Generate in Dashboard → API Keys',
            required: true,
        },
        {
            key: 'userId',
            type: 'text',
            label: 'User ID',
            placeholder: 'Jellyfin User ID (GUID)',
            hint: 'Found in Dashboard → Users → click user → the userId parameter in the URL.',
            required: true,
        },
        {
            key: 'webUrl',
            type: 'url',
            label: 'Web Interface URL',
            placeholder: '(Same as Jellyfin URL)',
            hint: 'URL for "Open in Jellyfin" links. Leave empty to use the server URL above.',
            required: false,
        },
    ],
};

/**
 * Config fields that require connection refresh when changed.
 * Changes to other fields (librarySyncEnabled, webUrl) won't trigger reconnection.
 */
export const connectionFields = ['url', 'apiKey', 'userId'];

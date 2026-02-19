import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// PLEX PLUGIN METADATA
// ============================================================================

export const id = 'plex';
export const name = 'Plex';
export const description = 'Media server for movies, TV shows, and music';
export const category: IntegrationCategory = 'media';
export const icon = 'system:plex';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Plex URL',
            placeholder: 'http://192.168.1.100:32400',
            required: true,
        },
        {
            key: 'token',
            type: 'text',
            sensitive: true,
            label: 'X-Plex-Token',
            placeholder: 'Your Plex authentication token',
            hint: 'Find your token in Plex Web → Settings → Account',
            required: true,
        },
    ],
};

/**
 * Config fields that require connection refresh when changed.
 * Changes to other fields (librarySyncEnabled, displayName) won't trigger reconnection.
 */
export const connectionFields = ['url', 'token', 'machineId'];

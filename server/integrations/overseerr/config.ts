import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// OVERSEERR PLUGIN METADATA
// ============================================================================

export const id = 'overseerr';
export const name = 'Overseerr';
export const description = 'Media request management for Plex';
export const category: IntegrationCategory = 'management';
export const icon = 'system:overseerr';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Overseerr URL',
            placeholder: 'http://192.168.1.5:5055',
            required: true,
        },
        {
            key: 'apiKey',
            type: 'password',
            label: 'API Key',
            placeholder: 'Your Overseerr API key',
            required: true,
        },
        {
            key: 'enableAutoApprove',
            type: 'checkbox',
            label: 'Enable Auto-Approve',
            hint: 'Automatically approve requests from trusted users',
            required: false,
        },
    ],
};

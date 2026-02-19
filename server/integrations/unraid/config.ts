/**
 * Unraid Integration - Configuration
 *
 * Defines the metadata and config schema for the Unraid integration.
 * Uses the Unraid 7.2+ built-in GraphQL API.
 */

import type { ConfigSchema } from '../types';

// ============================================================================
// METADATA
// ============================================================================

export const id = 'unraid';
export const name = 'Unraid';
export const description = 'Unraid server monitoring via GraphQL API (requires 7.2+)';
export const category = 'system' as const;
export const icon = 'system:unraid';

// ============================================================================
// CONFIG SCHEMA
// ============================================================================

export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Unraid URL',
            placeholder: 'http://tower.local',
            hint: 'Your Unraid server address',
            required: true,
        },
        {
            key: 'apiKey',
            type: 'text',
            sensitive: true,
            label: 'API Key',
            hint: 'Generate in Settings → Management Access → API Keys',
            required: true,
        },
    ],
    infoMessage: {
        icon: 'info',
        title: 'Requires Unraid 7.2+',
        content: 'This integration uses the built-in GraphQL API available in Unraid 7.2 and later. Generate an API key with "Viewer" role for read-only monitoring.',
    },
};

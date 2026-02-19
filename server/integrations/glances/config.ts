import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// GLANCES PLUGIN METADATA
// ============================================================================

export const id = 'glances';
export const name = 'Glances';
export const description = 'Cross-platform system monitoring tool';
export const category: IntegrationCategory = 'system';
export const icon = 'system:glances';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Glances URL',
            placeholder: 'http://192.168.1.5:61208',
            required: true,
        },
        {
            key: 'password',
            type: 'text',
            sensitive: true,
            label: 'Password',
            placeholder: 'Glances password (optional)',
            hint: 'Leave empty if Glances has no authentication',
            required: false,
        },
    ],
};

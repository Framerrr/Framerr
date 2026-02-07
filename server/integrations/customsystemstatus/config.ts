import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// CUSTOM SYSTEM STATUS PLUGIN METADATA
// ============================================================================

export const id = 'customsystemstatus';
export const name = 'Custom System Status';
export const description = 'Your own system monitoring API endpoint';
export const category: IntegrationCategory = 'system';
export const icon = 'Activity';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'API URL',
            placeholder: 'http://192.168.1.5:8080/status',
            required: true,
        },
        {
            key: 'token',
            type: 'password',
            label: 'Bearer Token',
            placeholder: 'Optional authentication token',
            hint: 'Leave empty if no authentication required',
            required: false,
        },
    ],
};

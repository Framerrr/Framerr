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
            placeholder: 'http://192.168.1.5:8080',
            required: true,
        },
        {
            key: 'token',
            type: 'text',
            sensitive: true,
            label: 'Bearer Token',
            placeholder: 'Optional authentication token',
            hint: 'Leave empty if no authentication required',
            required: false,
        },
    ],
    infoMessage: {
        icon: 'code',
        title: 'Endpoint Requirements',
        content: 'Your API must provide a GET /status endpoint returning JSON with: cpu (0-100), memory (0-100), temperature (°C, optional), and uptime (string or seconds).\n\nFor metric history graphs, optionally provide GET /history?metric=cpu&range=1h returning { data: [{ t, v }], availableRange, resolution }.',
    },
};

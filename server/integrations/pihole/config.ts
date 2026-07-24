import { ConfigSchema, IntegrationCategory } from '../types';

export const id = 'pihole';
export const name = 'Pi-hole';
export const description = 'Network-wide ad blocking';
export const category: IntegrationCategory = 'management';
export const icon = 'system:pi-hole';
export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'Pi-hole URL',
            placeholder: 'http://192.168.1.5',
            required: true,
        },
        {
            key: 'password',
            type: 'text',
            sensitive: true,
            label: 'Password',
            placeholder: 'Your Pi-hole web password',
            required: true,
        },
    ],
};

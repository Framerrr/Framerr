import { ConfigSchema, IntegrationCategory } from '../types';

export const id = 'adguard';
export const name = 'AdGuard Home';
export const description = 'DNS filtering and ad blocking';
export const category: IntegrationCategory = 'management';
export const icon = 'system:adguard-home';
export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'AdGuard Home URL',
            placeholder: 'http://192.168.1.5:3000',
            required: true,
        },
        {
            key: 'username',
            type: 'text',
            label: 'Username',
            placeholder: 'admin',
            required: false,
        },
        {
            key: 'password',
            type: 'text',
            sensitive: true,
            label: 'Password',
            placeholder: '',
            required: false,
        },
    ],
};

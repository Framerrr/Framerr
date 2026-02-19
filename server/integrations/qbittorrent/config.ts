import { ConfigSchema, IntegrationCategory } from '../types';

// ============================================================================
// QBITTORRENT PLUGIN METADATA
// ============================================================================

export const id = 'qbittorrent';
export const name = 'qBittorrent';
export const description = 'Open-source BitTorrent client with web interface';
export const category: IntegrationCategory = 'media';
export const icon = 'system:qbittorrent';


export const configSchema: ConfigSchema = {
    fields: [
        {
            key: 'url',
            type: 'url',
            label: 'qBittorrent URL',
            placeholder: 'http://192.168.1.100:8080',
            hint: 'URL to your qBittorrent Web UI',
            required: true,
        },
        {
            key: 'username',
            type: 'text',
            label: 'Username',
            placeholder: 'admin',
            hint: 'Leave empty if authentication is disabled',
            required: false,
        },
        {
            key: 'password',
            type: 'text',
            sensitive: true,
            label: 'Password',
            placeholder: 'Password',
            hint: 'Leave empty if authentication is disabled',
            required: false,
        },
    ],
};

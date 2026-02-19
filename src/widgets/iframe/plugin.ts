/**
 * Iframe Widget Plugin
 *
 * Embeds external web pages in a sandboxed iframe.
 */

import { lazy } from 'react';
import { Globe } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'iframe',
    name: 'Iframe',
    description: 'Embed external web pages',
    category: 'utility',
    icon: Globe,
    sizing: {
        default: { w: 6, h: 6 },
        min: { w: 2, h: 2 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./IframeWidget')),
    isGlobal: true,
    configConstraints: {
        contentPadding: 'none',
        options: [
            {
                key: 'url',
                label: 'URL',
                type: 'text',
                placeholder: 'https://example.com',
            },
            {
                key: 'refreshInterval',
                label: 'Auto-Refresh',
                type: 'select',
                choices: [
                    { value: '0', label: 'Off' },
                    { value: '30', label: '30 seconds' },
                    { value: '60', label: '1 minute' },
                    { value: '300', label: '5 minutes' },
                    { value: '900', label: '15 minutes' },
                    { value: '1800', label: '30 minutes' },
                    { value: '3600', label: '1 hour' },
                ],
            },
            {
                key: 'allowInteraction',
                label: 'Allow Interaction',
                type: 'toggle',
            },
        ],
    },
    defaultConfig: {
        url: '',
        refreshInterval: '0',
        allowInteraction: true,
    },
};

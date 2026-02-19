/**
 * Custom HTML Widget Plugin
 *
 * User-defined HTML and CSS content.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Code } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'custom-html',
    name: 'Custom HTML',
    description: 'User-defined HTML and CSS content',
    category: 'utility',
    icon: Code,
    sizing: {
        default: { w: 6, h: 6 },
        min: { w: 2, h: 2 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./CustomHTMLWidget')),
    isGlobal: true,
    configConstraints: {
        contentPadding: 'none',
        options: [
            {
                key: 'htmlContent',
                label: 'HTML Content',
                type: 'textarea',
                syntax: 'html',
                placeholder: '<h1>Hello World</h1>\n<p>Your custom content here</p>',
                rows: 8,
            },
            {
                key: 'cssContent',
                label: 'CSS Styles',
                type: 'textarea',
                syntax: 'css',
                placeholder: 'h1 {\n  color: var(--accent);\n  font-size: 2rem;\n}',
                rows: 6,
            },
        ],
    },
};

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
        min: { w: 4, h: 2 },
        max: { w: 24, h: 18 },
    },
    component: lazy(() => import('./CustomHTMLWidget')),
    isGlobal: true
};

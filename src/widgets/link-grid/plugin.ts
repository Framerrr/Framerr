/**
 * Link Grid Widget Plugin
 *
 * Quick access links with icons.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Link, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import type { WidgetPlugin } from '../types';
import LinkOrderEditor from './components/LinkOrderEditor';

export const plugin: WidgetPlugin = {
    id: 'link-grid',
    name: 'Link Grid',
    description: 'Quick access links with icons',
    category: 'utility',
    icon: Link,
    sizing: {
        default: { w: 12, h: 1 },
        min: { w: 2, h: 1 },
        max: { w: 24, h: 12 },
    },
    component: lazy(() => import('./LinkGridWidget')),
    defaultConfig: {
        hideHeader: true
    },
    isGlobal: true,
    configConstraints: {
        supportsHeader: false,
        contentPadding: 'none',
        options: [
            {
                key: 'gridJustify',
                label: 'Grid Alignment',
                type: 'buttons',
                defaultValue: 'center',
                choices: [
                    { value: 'left', label: 'Left', icon: AlignLeft },
                    { value: 'center', label: 'Center', icon: AlignCenter },
                    { value: 'right', label: 'Right', icon: AlignRight }
                ]
            },
            {
                key: 'linkOrder',
                label: 'Link Order',
                type: 'component',
                component: LinkOrderEditor
            }
        ]
    }
};


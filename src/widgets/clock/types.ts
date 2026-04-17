/**
 * Clock Widget Types
 */

import type { WidgetProps } from '../types';

export interface ClockPreferences {
    format24h: boolean;
    timezone: string;
    showDate: boolean;
    showSeconds: boolean;
}

export interface ClockConfig extends Partial<ClockPreferences> {
    [key: string]: unknown;
}

// Extends canonical WidgetProps
export type ClockWidgetProps = WidgetProps;


/**
 * System Status Widget Types
 */

import type { WidgetProps } from '../types';

export interface StatusData {
    cpu: number;
    memory: number;
    temperature: number;
    uptime: string;
}

// Extends canonical WidgetProps
export interface SystemStatusWidgetProps extends WidgetProps {
    // No additional props needed
}


/**
 * Iframe Widget Types
 */

import type { WidgetProps } from '../types';

export interface IframeConfig {
    url?: string;
    refreshInterval?: number; // seconds, 0 = off
    allowInteraction?: boolean;
    [key: string]: unknown;
}

// Extends canonical WidgetProps
export interface IframeWidgetProps extends WidgetProps {
    // No additional props needed
}

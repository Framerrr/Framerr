/**
 * Custom HTML Widget Types
 */

import type { WidgetProps } from '../types';

export interface CustomHTMLConfig {
    htmlContent?: string;
    cssContent?: string;
    [key: string]: unknown;
}

// Extends canonical WidgetProps
export type CustomHTMLWidgetProps = WidgetProps;


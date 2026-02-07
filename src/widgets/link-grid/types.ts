/**
 * LinkGrid Widget Types
 * 
 * All type definitions for the LinkGrid widget.
 * Extracted from LinkGridWidget_v2.tsx for better organization.
 */

// === Core Enums/Union Types ===

export type LinkSize = 'circle' | 'rectangle';
export type LinkType = 'link' | 'action';
export type LinkState = 'idle' | 'loading' | 'success' | 'error';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type GridJustify = 'left' | 'center' | 'right';

// === Data Structures ===

export interface LinkAction {
    method: HttpMethod;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
}

export interface LinkStyle {
    showIcon?: boolean;
    showText?: boolean;
}

export interface Link {
    id: string;
    title: string;
    icon: string;
    size: LinkSize;
    type: LinkType;
    url?: string;
    style?: LinkStyle;
    action?: LinkAction;
}

export interface LinkPosition {
    linkId: string;
    gridCol: number;
    gridRow: number;
    gridColSpan: number;
    gridRowSpan: number;
}

// === Grid Layout ===

export interface GridMetrics {
    cols: number;
    rows: number;
    cellSize: number;
    maxRows: number;
}

export interface ContainerSize {
    width: number;
    height: number;
}

// === Form State ===

export interface LinkFormData {
    title: string;
    icon: string;
    size: LinkSize;
    type: LinkType;
    url: string;
    showIcon: boolean;
    showText: boolean;
    action: LinkAction;
}

// === Widget Config & Props ===

export interface LinkGridWidgetConfig {
    links?: Link[];
    gridJustify?: GridJustify;
    [key: string]: unknown;
}

import type { WidgetProps } from '../types';

/**
 * LinkGrid widget extends WidgetProps with drag control callback.
 * This allows the widget to disable dashboard drag during inline editing.
 */
export interface LinkGridWidgetProps extends WidgetProps {
    /** Callback to control dashboard drag behavior (for inline editing) */
    setGlobalDragEnabled?: (enabled: boolean) => void;
}

// === Internal Types for Hooks ===

export interface TouchDragRef {
    linkId: string;
    originalIndex: number;
    startX: number;
    startY: number;
    timerId: ReturnType<typeof setTimeout> | null;
    isDragging: boolean;
    cleanupListeners: (() => void) | null;
    currentTargetSlot: number;
}

export interface TouchDragPosition {
    x: number;
    y: number;
}

// === Constants ===

export const GRID_CONSTANTS = {
    MIN_CELL_SIZE: 40,
    MAX_CELL_SIZE: 80,
    TOUCH_HOLD_THRESHOLD: 170, // ms
    getGridGap: (containerWidth: number) => containerWidth < 768 ? 4 : 8,
} as const;

// === Default Values ===

export const DEFAULT_FORM_DATA: LinkFormData = {
    title: '',
    icon: 'Link',
    size: 'circle',
    type: 'link',
    url: '',
    showIcon: true,
    showText: true,
    action: {
        method: 'GET',
        url: '',
        headers: {},
        body: null
    }
};

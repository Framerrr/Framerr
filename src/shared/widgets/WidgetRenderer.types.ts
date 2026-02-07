/**
 * WidgetRenderer Type Definitions
 * 
 * Props for the unified grid/layout widget renderer component.
 * Used in: Dashboard, Template Builder Step 2, Thumbnails
 */

import type { LucideIcon } from 'lucide-react';
import type { FramerrWidget } from '../../../shared/types/widget';

/**
 * WidgetRenderer modes:
 * - live: Real data, full interactivity (Dashboard)
 * - preview: Mock data, limited controls (Template Builder)
 * - thumbnail: Mock data, no controls, scaled (Template cards)
 */
export type WidgetRenderMode = 'live' | 'preview' | 'thumbnail';

/**
 * Padding sizes using fluid clamp() values:
 * - none: 0px (widget handles its own)
 * - compact: clamp(2px, 1cqi, 8px) - tight, for data-dense widgets
 * - default: clamp(4px, 2cqi, 16px) - balanced
 * - relaxed: clamp(8px, 3cqi, 24px) - spacious
 */
export type WidgetPaddingSize = 'none' | 'compact' | 'default' | 'relaxed';

export interface WidgetRendererProps {
    // Core
    widget: FramerrWidget;
    mode: WidgetRenderMode;

    // Header config
    title?: string;
    icon?: LucideIcon;
    showHeader?: boolean;     // From widget config

    // Styling
    scale?: number;           // For thumbnails (default: 1)
    flatten?: boolean;        // From widget config
    paddingSize?: WidgetPaddingSize;

    // Edit mode controls
    editMode?: boolean;
    isMobile?: boolean;          // For mobile-specific UI (resize handles)
    onEdit?: () => void;
    onMoveResize?: () => void;
    onDuplicate?: () => void;
    onDelete?: (id: string) => void;

    // Data injection (preview/thumbnail modes)
    injectedData?: unknown;

    // Content
    children?: React.ReactNode;
}

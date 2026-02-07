/**
 * WidgetCard Type Definitions
 * 
 * Props for the unified widget selection card component.
 * Used in: Widget Gallery, Add Widget Modal, Template Builder sidebar
 */

import type { WidgetMetadata } from '../../widgets/registry';

// Re-export from existing types for convenience
export type { IntegrationConfig, SharedIntegration } from '../../settings/widgets/types';
import type { IntegrationConfig, SharedIntegration } from '../../settings/widgets/types';

/**
 * WidgetCard variants control display differences:
 * - gallery: Full display with share button (admin), description
 * - modal: Compact with drag support, truncated description
 * - builder: Minimal - just icon, name, size
 */
export type WidgetCardVariant = 'gallery' | 'modal' | 'builder';

export interface WidgetCardProps {
    // Core
    widget: WidgetMetadata;
    variant: WidgetCardVariant;

    // Actions
    onAdd?: (widgetType: string) => void;
    onShare?: (widget: WidgetMetadata) => void;  // Gallery only

    // State
    isAdding?: boolean;       // Loading state for add button
    shareLoading?: boolean;   // Loading state for share button
    disabled?: boolean;       // Disable all interactions

    // Integration status (for badges)
    integrations?: Record<string, IntegrationConfig>;
    sharedIntegrations?: SharedIntegration[];
    isIntegrationReady?: boolean;

    // Permissions
    hasAdminAccess?: boolean;
    sharedBy?: string;        // For non-admin "Shared by X" badge

    // Drag support (modal variant) - uses dnd-kit when inside DndContext
    draggable?: boolean;

    /** When true, forces the card to fill its container (width: 100%, height: 100%).
     * Used in DragOverlay to match exact captured dimensions. */
    fillContainer?: boolean;

    /** @deprecated Use draggable prop instead - dnd-kit handles events */
    onDragStart?: (e: React.DragEvent<HTMLDivElement>, widgetType: string) => void;
    /** @deprecated Use draggable prop instead - dnd-kit handles events */
    onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
}

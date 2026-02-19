/**
 * LinkOrderEditor - Drag-to-reorder links within the config modal.
 *
 * Uses @dnd-kit (same as TabSettings / GroupSection) for reliable
 * touch + mouse drag handling without passive event listener issues.
 *
 * Replaces the live on-widget drag reordering (useDesktopDrag / useTouchDrag)
 * to eliminate gesture conflicts with the dashboard grid's drag system.
 *
 * Rendered as a `component` type option in WidgetConfigModal via the plugin.
 */

import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { getIconComponent } from '../../../utils/iconUtils';
import type { Link } from '../types';

// ============================================================================
// Sortable Link Item
// ============================================================================

interface SortableLinkItemProps {
    link: Link;
}

const SortableLinkItem: React.FC<SortableLinkItemProps> = ({ link }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: link.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : transition,
        opacity: isDragging ? 0.4 : 1,
        willChange: isDragging ? 'transform' : 'auto',
        zIndex: isDragging ? 10 : 'auto',
    } as React.CSSProperties;

    const Icon = getIconComponent(link.icon);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg
                bg-theme-tertiary transition-all duration-150
                ${isDragging ? 'ring-2 ring-accent shadow-lg' : ''}
            `}
        >
            {/* Drag handle — only this element triggers drag */}
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-theme-tertiary flex-shrink-0"
                style={{
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                } as React.CSSProperties}
                title="Drag to reorder"
            >
                <GripVertical size={14} />
            </button>
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                <Icon size={16} className="text-theme-secondary" />
            </div>
            <span className="text-sm text-theme-primary truncate flex-1">
                {link.title || 'Untitled'}
            </span>
            <span className="text-xs text-theme-tertiary flex-shrink-0 capitalize">
                {link.size}
            </span>
        </div>
    );
};

// ============================================================================
// Link Order Editor
// ============================================================================

interface LinkOrderEditorProps {
    config: Record<string, unknown>;
    updateConfig: (key: string, value: unknown) => void;
}

const LinkOrderEditor: React.FC<LinkOrderEditorProps> = ({ config, updateConfig }) => {
    const links = (config.links as Link[]) || [];

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Nothing to reorder with 0 or 1 links
    if (links.length <= 1) return null;

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = links.findIndex(l => l.id === active.id);
        const newIndex = links.findIndex(l => l.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        updateConfig('links', arrayMove(links, oldIndex, newIndex));
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={links.map(l => l.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-1">
                    {links.map(link => (
                        <SortableLinkItem key={link.id} link={link} />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
};

export default LinkOrderEditor;

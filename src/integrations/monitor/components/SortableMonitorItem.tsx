/**
 * SortableMonitorItem - Wrapper for sortable monitors with drag handle
 * Extracted from MonitorForm.tsx during Phase 1.5.2 refactor
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { SortableMonitorItemProps } from '../types';

const SortableMonitorItem: React.FC<SortableMonitorItemProps> = ({ id, children, isExpanded }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : transition,
        opacity: isDragging ? 0.5 : 1,
        willChange: isDragging ? 'transform' : 'auto',
    } as React.CSSProperties;

    return (
        <div ref={setNodeRef} style={style} className="relative">
            {/* Drag handle - only visible when collapsed */}
            {!isExpanded && (
                <button
                    {...attributes}
                    {...listeners}
                    className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-theme-tertiary hover:text-theme-primary transition-colors z-10"
                    style={{
                        touchAction: 'none',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                    } as React.CSSProperties}
                    title="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical size={16} />
                </button>
            )}
            {/* Add left padding when collapsed to make room for drag handle */}
            <div className={!isExpanded ? 'pl-7' : ''}>
                {children}
            </div>
        </div>
    );
};

export default SortableMonitorItem;

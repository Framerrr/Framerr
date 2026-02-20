/**
 * GroupItem Component
 * 
 * A sortable group item for the tab groups list.
 * Handles drag-and-drop reordering and inline actions (edit, delete).
 */

import React from 'react';
import { FolderTree, Edit, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ConfirmButton } from '../../../shared/ui';
import type { TabGroup } from '../types';

export interface GroupItemProps {
    group: TabGroup;
    onEdit: (group: TabGroup) => void;
    onDelete: (group: TabGroup) => void;
}

export const GroupItem: React.FC<GroupItemProps> = ({
    group,
    onEdit,
    onDelete,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: group.id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : transition,
        opacity: isDragging ? 0.5 : 1,
        willChange: isDragging ? 'transform' : 'auto'
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-theme-tertiary rounded-xl p-4 border border-theme flex items-center gap-4 hover:bg-theme-hover transition-colors"
        >
            {/* Drag Handle */}
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-theme-tertiary hover:text-theme-primary transition-colors"
                style={{
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                    WebkitTouchCallout: 'none'
                } as React.CSSProperties}
                title="Drag to reorder"
            >
                <GripVertical size={20} />
            </button>

            <FolderTree size={20} className="text-accent flex-shrink-0" />

            <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-theme-primary">{group.name}</h3>
            </div>

            <div className="flex gap-2 flex-shrink-0">
                <button
                    onClick={() => onEdit(group)}
                    className="inline-flex items-center justify-center h-7 px-2 text-xs gap-1 rounded-lg font-medium text-accent hover:bg-white/10 transition-colors"
                    title="Edit group"
                >
                    <Edit size={14} />
                    <span className="hidden sm:inline">Edit</span>
                </button>
                <ConfirmButton
                    onConfirm={() => onDelete(group)}
                    label="Delete"
                    size="sm"
                    confirmMode="icon"
                />
            </div>
        </div>
    );
};


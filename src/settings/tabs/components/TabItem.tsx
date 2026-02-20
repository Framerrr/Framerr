/**
 * TabItem Component
 * 
 * A sortable tab item for the drag-and-drop list.
 * Displays tab information with edit/delete actions.
 */

import React from 'react';
import { Edit, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ConfirmButton } from '../../../shared/ui';
import { renderIcon } from '../../../utils/iconUtils';
import type { Tab } from '../types';

interface TabItemProps {
    tab: Tab;
    onEdit: (tab: Tab) => void;
    onDelete: (tabId: string, tabName: string) => void;
}

export const TabItem: React.FC<TabItemProps> = ({
    tab,
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
    } = useSortable({ id: tab.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : transition,
        opacity: isDragging ? 0.5 : 1,
        willChange: isDragging ? 'transform' : 'auto',
    } as React.CSSProperties;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-theme-tertiary rounded-xl p-4 border border-theme flex items-center justify-between hover:bg-theme-hover transition-colors"
        >
            {/* Drag Handle */}
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-theme-tertiary hover:text-theme-primary transition-colors mr-3"
                style={{
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                } as React.CSSProperties}
                title="Drag to reorder"
            >
                <GripVertical size={20} />
            </button>

            {/* Tab Info */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-shrink-0">
                    {renderIcon(tab.icon, 20, 'text-accent')}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium text-theme-primary">{tab.name}</span>
                        <span className="text-xs text-theme-tertiary font-mono">/{tab.slug}</span>
                        {!tab.enabled && (
                            <span className="text-xs px-2 py-0.5 bg-theme-tertiary text-theme-secondary rounded">
                                Disabled
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-theme-secondary mt-1 truncate">{tab.url}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
                <button
                    onClick={() => onEdit(tab)}
                    className="inline-flex items-center justify-center h-7 px-2 text-xs gap-1 rounded-lg font-medium text-accent hover:bg-white/10 dark:hover:bg-white/10 transition-colors"
                    title="Edit tab"
                >
                    <Edit size={14} />
                    <span className="hidden sm:inline">Edit</span>
                </button>
                <ConfirmButton
                    onConfirm={() => onDelete(tab.id, tab.name)}
                    label="Delete"
                    size="sm"
                    confirmMode="icon"
                />
            </div>
        </div>
    );
};


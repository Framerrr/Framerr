/**
 * WidgetActionsPopover - Unified action menu for widget edit controls
 * 
 * Replaces the old delete button with a popover menu containing:
 * - Edit (opens WidgetConfigModal)
 * - Move & Resize (future feature - disabled)
 * - Duplicate (clones widget with same size)
 * - Delete (inline ConfirmButton)
 * 
 * Migrated to shared Popover primitive.
 */

import React, { useState } from 'react';
import { Settings, Pencil, Move, Copy } from 'lucide-react';
import { Popover, ConfirmButton } from '../../../shared/ui';

export interface WidgetActionsPopoverProps {
    widgetId: string;
    onEdit?: () => void;
    onMoveResize?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
}

const WidgetActionsPopover: React.FC<WidgetActionsPopoverProps> = ({
    widgetId,
    onEdit,
    onMoveResize,
    onDuplicate,
    onDelete
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
    };

    const handleEdit = () => {
        onEdit?.();
        setIsOpen(false);
    };

    const handleMoveResize = () => {
        onMoveResize?.();
        setIsOpen(false);
    };

    const handleDuplicate = () => {
        onDuplicate?.();
        setIsOpen(false);
    };

    const handleDelete = () => {
        onDelete?.();
        setIsOpen(false);
    };

    // Menu item base styles
    const menuItemBase = `
        w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg
        transition-all duration-150 cursor-pointer text-left
    `;

    const menuItemEnabled = `
        ${menuItemBase}
        text-theme-primary hover:bg-theme-hover active:bg-theme-tertiary
    `;

    const menuItemDisabled = `
        ${menuItemBase}
        text-theme-tertiary cursor-not-allowed opacity-50
    `;

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <Popover.Trigger asChild>
                <button
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 rounded bg-white/20 backdrop-blur-md
                        flex items-center justify-center text-white/80 hover:text-white hover:bg-white/30
                        transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    aria-label="Widget actions"
                    data-widget-id={widgetId}
                    data-walkthrough="widget-config-button"
                >
                    <Settings size={14} />
                </button>
            </Popover.Trigger>

            <Popover.Content
                side="left"
                align="start"
                sideOffset={8}
                className="w-[240px] p-1.5"
            >
                {/* Edit */}
                <button
                    onClick={handleEdit}
                    className={menuItemEnabled}
                    disabled={!onEdit}
                    data-walkthrough="widget-edit-button"
                    data-widget-id={widgetId}
                >
                    <Pencil size={16} />
                    <span>Edit</span>
                </button>

                {/* Move & Resize */}
                <button
                    onClick={handleMoveResize}
                    className={onMoveResize ? menuItemEnabled : menuItemDisabled}
                    disabled={!onMoveResize}
                >
                    <Move size={16} />
                    <span>Move & Resize</span>
                </button>

                {/* Duplicate */}
                <button
                    onClick={handleDuplicate}
                    className={menuItemEnabled}
                    disabled={!onDuplicate}
                >
                    <Copy size={16} />
                    <span>Duplicate</span>
                </button>

                {/* Divider */}
                <div className="h-px bg-theme-light/20 my-1.5" />

                {/* Delete - Inline ConfirmButton */}
                <ConfirmButton
                    onConfirm={handleDelete}
                    label="Delete"
                    size="md"
                    disabled={!onDelete}
                    className="w-full"
                />
            </Popover.Content>
        </Popover>
    );
};

export default WidgetActionsPopover;

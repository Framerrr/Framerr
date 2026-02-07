/**
 * MultiSelectDropdown Primitive
 * 
 * Generic multi-select dropdown component with:
 * - Checkboxes for each option
 * - Optional bulk actions (Select All / Select None)
 * - Size variants
 * - Scrollable content with max height
 * 
 * Domain-specific wrappers (IntegrationDropdown, EventDropdown) 
 * should use this primitive internally.
 * 
 * @example
 * <MultiSelectDropdown
 *     options={[{ id: '1', label: 'Option 1' }]}
 *     selectedIds={['1']}
 *     onChange={(ids) => setSelected(ids)}
 *     showBulkActions
 * />
 */

import React, { useState, useRef } from 'react';
import { ChevronDown, CheckSquare, XSquare } from 'lucide-react';
import { Checkbox } from '../Checkbox';
import { Popover } from '../Popover';

// ============================================================================
// Types
// ============================================================================

export interface MultiSelectOption {
    id: string;
    label: string;
}

export interface MultiSelectDropdownProps {
    /** Available options to select from */
    options: MultiSelectOption[];
    /** Currently selected option IDs */
    selectedIds: string[];
    /** Callback when selection changes */
    onChange: (ids: string[]) => void;
    /** Disable the dropdown */
    disabled?: boolean;
    /** Size variant - sm for compact cards, md for modals */
    size?: 'sm' | 'md';
    /** Popover alignment relative to trigger */
    align?: 'start' | 'end';
    /** Custom placeholder text */
    placeholder?: string;
    /** Show Select All / Select None buttons */
    showBulkActions?: boolean;
    /** Text when all are selected */
    allSelectedText?: string;
    /** Text when none are available */
    emptyText?: string;
    /** Maximum number of selections allowed (optional) */
    maxSelections?: number;
    /** Whether trigger should fill full width of container */
    fullWidth?: boolean;
}

// ============================================================================
// Size Configuration
// ============================================================================

const sizeConfig = {
    sm: {
        trigger: 'px-2.5 py-1.5 text-xs rounded-md min-w-[120px] max-w-[160px]',
        icon: 14,
        content: 'min-w-[180px]',
        itemText: 'text-xs',
    },
    md: {
        trigger: 'px-3 py-2 text-sm rounded-lg min-w-[120px]',
        icon: 16,
        content: 'min-w-[200px]',
        itemText: 'text-sm',
    },
} as const;

// ============================================================================
// Component
// ============================================================================

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
    options,
    selectedIds,
    onChange,
    disabled = false,
    size = 'md',
    align = 'start',
    placeholder = 'Select...',
    showBulkActions = true,
    allSelectedText = 'All selected',
    emptyText = 'No options',
    maxSelections,
    fullWidth = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const config = sizeConfig[size];

    // Check if max selections reached
    const isAtLimit = maxSelections !== undefined && selectedIds.length >= maxSelections;

    const handleToggle = (optionId: string) => {
        if (selectedIds.includes(optionId)) {
            // Always allow deselection
            onChange(selectedIds.filter(id => id !== optionId));
        } else if (!isAtLimit) {
            // Only allow selection if not at limit
            onChange([...selectedIds, optionId]);
        }
    };

    const handleSelectAll = () => {
        // Respect maxSelections limit
        const allIds = options.map(o => o.id);
        if (maxSelections !== undefined) {
            onChange(allIds.slice(0, maxSelections));
        } else {
            onChange(allIds);
        }
    };

    const handleSelectNone = () => {
        onChange([]);
    };

    // Display text based on selection (include max indicator if applicable)
    const getDisplayText = () => {
        if (selectedIds.length === 0) return placeholder;
        if (selectedIds.length === 1) {
            return options.find(o => o.id === selectedIds[0])?.label || '1 selected';
        }
        if (selectedIds.length === options.length && !maxSelections) {
            return allSelectedText;
        }
        if (maxSelections) {
            return `${selectedIds.length}/${maxSelections} selected`;
        }
        return `${selectedIds.length} selected`;
    };
    const displayText = getDisplayText();

    // Empty state for no options
    if (options.length === 0) {
        return (
            <span className={`${config.itemText} text-theme-tertiary px-2`}>
                {emptyText}
            </span>
        );
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                <button
                    ref={triggerRef}
                    disabled={disabled}
                    className={`
                        inline-flex items-center justify-between gap-2
                        ${config.trigger}
                        ${fullWidth ? 'w-full' : ''}
                        bg-theme-tertiary border border-theme
                        text-theme-primary
                        hover:bg-theme-hover transition-colors
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-theme-primary
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    <span className="truncate">{displayText}</span>
                    <ChevronDown
                        size={config.icon}
                        className={`text-theme-secondary flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>
            </Popover.Trigger>
            <Popover.Content align={align} sideOffset={4} className={`p-1 ${config.content}`}>
                {/* Bulk Actions */}
                {showBulkActions && options.length > 1 && (
                    <>
                        <div className="flex gap-1 px-2 py-1.5">
                            <button
                                onClick={handleSelectAll}
                                className="flex items-center gap-1.5 px-2 py-1 text-xs text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded transition-colors"
                            >
                                <CheckSquare size={12} />
                                All
                            </button>
                            <button
                                onClick={handleSelectNone}
                                className="flex items-center gap-1.5 px-2 py-1 text-xs text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded transition-colors"
                            >
                                <XSquare size={12} />
                                None
                            </button>
                        </div>
                        <div className="h-px bg-theme-hover mx-1 mb-1" />
                    </>
                )}

                {/* Scrollable Options List */}
                <div
                    className="max-h-[200px] overflow-y-scroll overscroll-contain"
                    onWheel={(e) => e.stopPropagation()}
                >
                    {options.map(option => {
                        const isSelected = selectedIds.includes(option.id);
                        const isDisabledByLimit = !isSelected && isAtLimit;

                        return (
                            <label
                                key={option.id}
                                className={`
                                    flex items-center gap-3 px-3 py-2 rounded-md transition-colors
                                    ${isDisabledByLimit
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'hover:bg-theme-hover cursor-pointer'}
                                `}
                            >
                                <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => handleToggle(option.id)}
                                    size="sm"
                                    disabled={isDisabledByLimit}
                                />
                                <span className={`${config.itemText} text-theme-primary`}>
                                    {option.label}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </Popover.Content>
        </Popover>
    );
};

export default MultiSelectDropdown;

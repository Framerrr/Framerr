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

import React, { useState, useRef, useMemo, useEffect } from 'react';
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
    /** Option IDs that appear checked & greyed out (non-interactive) */
    disabledIds?: string[];
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
    /** Minimum number of selections required (optional, prevents deselecting below this) */
    minSelections?: number;
    /** Whether trigger should fill full width of container */
    fullWidth?: boolean;
    /** Close dropdown when main scroll container is scrolled */
    closeOnScroll?: boolean;
    /** z-index for the popover content (default: 150) */
    zIndex?: number;
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
    disabledIds = [],
    size = 'md',
    align = 'start',
    placeholder = 'Select...',
    showBulkActions = true,
    allSelectedText = 'All selected',
    emptyText = 'No options',
    maxSelections,
    minSelections,
    fullWidth = false,
    closeOnScroll = false,
    zIndex = 150,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const config = sizeConfig[size];

    // Filter selectedIds to only include IDs that exist in options
    // This prevents stale/deleted integration IDs from inflating the count
    const validOptionIds = useMemo(() => new Set(options.map(o => o.id)), [options]);
    const validSelectedIds = useMemo(
        () => selectedIds.filter(id => validOptionIds.has(id)),
        [selectedIds, validOptionIds]
    );

    // Auto-clean stale IDs: if selectedIds contains IDs not in options, notify parent
    useEffect(() => {
        if (validSelectedIds.length !== selectedIds.length) {
            onChange(validSelectedIds);
        }
        // Only run when the valid count changes (not on every render)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [validSelectedIds.length, selectedIds.length]);

    // Check if max selections reached (use valid count)
    const isAtLimit = maxSelections !== undefined && validSelectedIds.length >= maxSelections;

    const handleToggle = (optionId: string) => {
        // Disabled options are non-interactive
        if (disabledIds.includes(optionId)) return;

        if (selectedIds.includes(optionId)) {
            // Prevent deselection if it would go below minSelections
            if (minSelections !== undefined && validSelectedIds.length <= minSelections) return;
            onChange(selectedIds.filter(id => id !== optionId));
        } else if (!isAtLimit) {
            // Only allow selection if not at limit
            onChange([...selectedIds, optionId]);
        }
    };

    const handleSelectAll = () => {
        // Exclude disabled options from bulk select
        const selectableIds = options.filter(o => !disabledIds.includes(o.id)).map(o => o.id);
        const alreadyDisabledSelected = options.filter(o => disabledIds.includes(o.id)).map(o => o.id);
        if (maxSelections !== undefined) {
            onChange([...alreadyDisabledSelected, ...selectableIds.slice(0, maxSelections)]);
        } else {
            onChange([...alreadyDisabledSelected, ...selectableIds]);
        }
    };

    const handleSelectNone = () => {
        onChange([]);
    };

    // Display text based on selection (use valid count for accuracy)
    const getDisplayText = () => {
        if (validSelectedIds.length === 0) return placeholder;
        if (validSelectedIds.length === 1) {
            return options.find(o => o.id === validSelectedIds[0])?.label || '1 selected';
        }
        if (validSelectedIds.length === options.length && !maxSelections) {
            return allSelectedText;
        }
        if (maxSelections) {
            return `${validSelectedIds.length}/${maxSelections} selected`;
        }
        return `${validSelectedIds.length} selected`;
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
        <Popover open={isOpen} onOpenChange={setIsOpen} closeOnScroll={closeOnScroll}>
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
            <Popover.Content align={align} sideOffset={4} className={`p-1 ${config.content}`} zIndex={zIndex}>
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
                            {(!minSelections || minSelections <= 0) && (
                                <button
                                    onClick={handleSelectNone}
                                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded transition-colors"
                                >
                                    <XSquare size={12} />
                                    None
                                </button>
                            )}
                        </div>
                        <div className="h-px bg-theme-hover mx-1 mb-1" />
                    </>
                )}

                {/* Scrollable Options List */}
                <div
                    data-scroll-lock-allow
                    className="max-h-[200px] overflow-y-auto overscroll-contain"
                >
                    {options.map(option => {
                        const isLocked = disabledIds.includes(option.id);
                        const isSelected = isLocked || selectedIds.includes(option.id);
                        const isDisabledByLimit = !isSelected && isAtLimit;
                        const isDisabledByMin = isSelected && !isLocked && minSelections !== undefined && validSelectedIds.length <= minSelections;
                        const isNonInteractive = isLocked || isDisabledByLimit || isDisabledByMin;

                        return (
                            <label
                                key={option.id}
                                className={`
                                    flex items-center gap-3 px-3 py-2 rounded-md transition-colors
                                    ${isNonInteractive
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'hover:bg-theme-hover cursor-pointer'}
                                `}
                            >
                                <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => handleToggle(option.id)}
                                    size="sm"
                                    disabled={isNonInteractive}
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

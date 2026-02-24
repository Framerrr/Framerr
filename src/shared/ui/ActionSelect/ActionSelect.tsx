/**
 * ActionSelect Compound Component
 * 
 * A popover-based dropdown selector with per-item inline actions.
 * Built on top of the existing Popover primitive.
 * 
 * Features:
 * - Click-to-select items with optional inline actions (delete, etc.)
 * - Optional search input in header
 * - Optional inline "add new" input in header (above search if both present)
 * - Optional "none" / deselect option
 * - Configurable close-on-select per item
 * - Animated with popIn transitions
 * 
 * @example — Category selector with add/delete
 * <ActionSelect>
 *   <ActionSelect.Trigger>
 *     <button>Select category...</button>
 *   </ActionSelect.Trigger>
 *   <ActionSelect.Content>
 *     <ActionSelect.AddInput
 *       placeholder="New category name"
 *       onAdd={(name) => createCategory(name)}
 *     />
 *     <ActionSelect.Items>
 *       {categories.map(cat => (
 *         <ActionSelect.Item
 *           key={cat.id}
 *           onClick={() => selectCategory(cat.id)}
 *           action={<button onClick={() => deleteCategory(cat.id)}>🗑</button>}
 *         >
 *           {cat.name}
 *         </ActionSelect.Item>
 *       ))}
 *     </ActionSelect.Items>
 *   </ActionSelect.Content>
 * </ActionSelect>
 * 
 * @example — Library picker with search
 * <ActionSelect>
 *   <ActionSelect.Trigger>
 *     <button>Saved Links (5)</button>
 *   </ActionSelect.Trigger>
 *   <ActionSelect.Content>
 *     <ActionSelect.Search value={q} onChange={setQ} placeholder="Search..." />
 *     <ActionSelect.Items>
 *       {filtered.map(link => (
 *         <ActionSelect.Item key={link.id} onClick={() => select(link)}>
 *           <LinkRow link={link} />
 *         </ActionSelect.Item>
 *       ))}
 *     </ActionSelect.Items>
 *   </ActionSelect.Content>
 * </ActionSelect>
 */

import React, { forwardRef, useState, createContext, useContext, useCallback } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { Popover } from '../Popover/Popover';
import { Input } from '../../../components/common/Input';

// ============================================================================
// Context
// ============================================================================

interface ActionSelectContextValue {
    isOpen: boolean;
    close: () => void;
}

const ActionSelectContext = createContext<ActionSelectContextValue | null>(null);

function useActionSelectContext() {
    const context = useContext(ActionSelectContext);
    if (!context) {
        throw new Error('ActionSelect compound components must be used within ActionSelect');
    }
    return context;
}

// ============================================================================
// ActionSelect Root
// ============================================================================

export interface ActionSelectProps {
    /** Controlled open state */
    open?: boolean;
    /** Called when open state changes */
    onOpenChange?: (open: boolean) => void;
    /** When false, disables close-on-scroll (for popovers with scrollable content) */
    closeOnScroll?: boolean;
    children: React.ReactNode;
}

export function ActionSelect({
    open,
    onOpenChange,
    closeOnScroll = false,
    children,
}: ActionSelectProps) {
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : internalOpen;

    const handleOpenChange = useCallback((newOpen: boolean) => {
        if (!isControlled) {
            setInternalOpen(newOpen);
        }
        onOpenChange?.(newOpen);
    }, [isControlled, onOpenChange]);

    const contextValue: ActionSelectContextValue = {
        isOpen,
        close: () => handleOpenChange(false),
    };

    return (
        <ActionSelectContext.Provider value={contextValue}>
            <Popover open={isOpen} onOpenChange={handleOpenChange} closeOnScroll={closeOnScroll}>
                {children}
            </Popover>
        </ActionSelectContext.Provider>
    );
}

// ============================================================================
// ActionSelect.Trigger
// ============================================================================

export interface ActionSelectTriggerProps {
    children: React.ReactNode;
    asChild?: boolean;
    className?: string;
}

const ActionSelectTrigger = forwardRef<HTMLButtonElement, ActionSelectTriggerProps>(
    ({ children, asChild = true, className = '' }, ref) => {
        return (
            <Popover.Trigger ref={ref} asChild={asChild} className={className}>
                {children}
            </Popover.Trigger>
        );
    }
);

ActionSelectTrigger.displayName = 'ActionSelect.Trigger';

// ============================================================================
// ActionSelect.Content
// ============================================================================

export interface ActionSelectContentProps {
    children: React.ReactNode;
    className?: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
    sideOffset?: number;
}

const ActionSelectContent = forwardRef<HTMLDivElement, ActionSelectContentProps>(
    ({ children, className = '', side = 'bottom', align = 'start', sideOffset = 4 }, ref) => {
        return (
            <Popover.Content
                ref={ref}
                side={side}
                align={align}
                sideOffset={sideOffset}
                className={`w-[var(--radix-popover-trigger-width)] p-1 ${className}`}
            >
                {children}
            </Popover.Content>
        );
    }
);

ActionSelectContent.displayName = 'ActionSelect.Content';

// ============================================================================
// ActionSelect.Search
// ============================================================================

export interface ActionSelectSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const ActionSelectSearch = forwardRef<HTMLDivElement, ActionSelectSearchProps>(
    ({ value, onChange, placeholder = 'Search...', className = '' }, ref) => {
        return (
            <div ref={ref} className={`px-1 pb-2 ${className}`}>
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    icon={Search}
                    size="sm"
                    className="!mb-0"
                    autoFocus
                />
            </div>
        );
    }
);

ActionSelectSearch.displayName = 'ActionSelect.Search';

// ============================================================================
// ActionSelect.AddInput
// ============================================================================

export interface ActionSelectAddInputProps {
    /** Called when user submits (Enter or click confirm) */
    onAdd: (value: string) => void | Promise<void>;
    placeholder?: string;
    /** Whether the add is in progress (shows loading state on confirm button) */
    loading?: boolean;
    className?: string;
}

const ActionSelectAddInput = forwardRef<HTMLDivElement, ActionSelectAddInputProps>(
    ({ onAdd, placeholder = 'Add new...', loading = false, className = '' }, ref) => {
        const [value, setValue] = useState('');

        const handleSubmit = () => {
            const trimmed = value.trim();
            if (!trimmed || loading) return;
            onAdd(trimmed);
            setValue('');
        };

        return (
            <div ref={ref} className={`px-1 pb-2 ${className}`}>
                <div className="flex items-center gap-1.5">
                    <div className="flex-1 relative">
                        <Input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={placeholder}
                            icon={Plus}
                            size="sm"
                            className="!mb-0"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                                // Don't stop Escape — let Popover handle close
                            }}
                        />
                    </div>
                    {value.trim() && (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex-shrink-0 p-1.5 rounded-md bg-accent text-white
                                       hover:opacity-90 disabled:opacity-50
                                       transition-opacity"
                            title="Add"
                        >
                            <Check size={14} />
                        </button>
                    )}
                </div>
            </div>
        );
    }
);

ActionSelectAddInput.displayName = 'ActionSelect.AddInput';

// ============================================================================
// ActionSelect.Items (scrollable container for the item list)
// ============================================================================

export interface ActionSelectItemsProps {
    children: React.ReactNode;
    className?: string;
    /** Max height before scrolling (default: 220px) */
    maxHeight?: number | string;
}

const ActionSelectItems = forwardRef<HTMLDivElement, ActionSelectItemsProps>(
    ({ children, className = '', maxHeight = 220 }, ref) => {
        const maxHeightValue = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;

        return (
            <>
                <style>{`
                    .action-select-items [data-selected] {
                        background: var(--bg-hover);
                    }
                    @media (hover: hover) {
                        .action-select-items:has(.action-select-item:hover) [data-selected]:not(:hover) {
                            background: transparent;
                        }
                    }
                `}</style>
                <div
                    ref={ref}
                    className={`action-select-items overflow-y-auto custom-scrollbar ${className}`}
                    style={{ maxHeight: maxHeightValue, overscrollBehavior: 'contain' }}
                >
                    {children}
                </div>
            </>
        );
    }
);

ActionSelectItems.displayName = 'ActionSelect.Items';

// ============================================================================
// ActionSelect.Item
// ============================================================================

export interface ActionSelectItemProps {
    children: React.ReactNode;
    className?: string;
    /** Called when the item row is clicked */
    onClick?: (e: React.MouseEvent) => void;
    /** Whether this item is currently selected (shows highlight) */
    selected?: boolean;
    /** When true, closes the dropdown after click (default: true) */
    closeOnClick?: boolean;
    /** Inline action element rendered on the right (e.g. delete button) */
    action?: React.ReactNode;
    disabled?: boolean;
}

const ActionSelectItem = forwardRef<HTMLDivElement, ActionSelectItemProps>(
    ({ children, className = '', onClick, selected = false, closeOnClick = true, action, disabled = false }, ref) => {
        const { close } = useActionSelectContext();

        const handleClick = (e: React.MouseEvent) => {
            if (disabled) return;
            onClick?.(e);
            if (closeOnClick) {
                close();
            }
        };

        return (
            <div
                ref={ref}
                data-selected={selected || undefined}
                className={`
                    action-select-item
                    group flex items-center justify-between gap-2 px-3 py-2 rounded-md
                    transition-colors text-sm
                    ${disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:bg-theme-hover'
                    }
                    ${selected
                        ? 'text-accent'
                        : disabled ? '' : 'text-theme-primary'
                    }
                    ${className}
                `}
            >
                {/* Main content — clickable */}
                <div
                    className="flex-1 min-w-0"
                    onClick={handleClick}
                >
                    {children}
                </div>

                {/* Action slot — does NOT trigger the item onClick */}
                {action && (
                    <div
                        className="flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {action}
                    </div>
                )}
            </div>
        );
    }
);

ActionSelectItem.displayName = 'ActionSelect.Item';

// ============================================================================
// ActionSelect.Empty
// ============================================================================

export interface ActionSelectEmptyProps {
    children: React.ReactNode;
    className?: string;
}

const ActionSelectEmpty = forwardRef<HTMLDivElement, ActionSelectEmptyProps>(
    ({ children, className = '' }, ref) => {
        return (
            <div
                ref={ref}
                className={`px-3 py-4 text-center text-xs text-theme-tertiary ${className}`}
            >
                {children}
            </div>
        );
    }
);

ActionSelectEmpty.displayName = 'ActionSelect.Empty';

// ============================================================================
// Attach compound components
// ============================================================================

ActionSelect.Trigger = ActionSelectTrigger;
ActionSelect.Content = ActionSelectContent;
ActionSelect.Search = ActionSelectSearch;
ActionSelect.AddInput = ActionSelectAddInput;
ActionSelect.Items = ActionSelectItems;
ActionSelect.Item = ActionSelectItem;
ActionSelect.Empty = ActionSelectEmpty;

export {
    ActionSelectTrigger,
    ActionSelectContent,
    ActionSelectSearch,
    ActionSelectAddInput,
    ActionSelectItems,
    ActionSelectItem,
    ActionSelectEmpty,
};

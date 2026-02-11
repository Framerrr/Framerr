/**
 * SearchDropdown Primitive
 *
 * A dropdown component designed for search input use cases where:
 * - The anchor is an input field (not a button trigger)
 * - Clear buttons and other controls should NOT close the dropdown
 * - The dropdown content should match the anchor width
 *
 * Uses Radix Popover internally for positioning but provides full
 * control over open/close behavior.
 *
 * @example
 * <SearchDropdown
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   anchorRef={inputContainerRef}
 *   ignoreCloseRefs={[clearButtonRef]}
 *   matchAnchorWidth
 * >
 *   <SearchDropdown.Content>
 *     {results.map(item => <ResultItem key={item.id} />)}
 *   </SearchDropdown.Content>
 * </SearchDropdown>
 */

import React, {
    forwardRef,
    useEffect,
    useCallback,
    createContext,
    useContext,
    useRef,
} from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import { motion } from 'framer-motion';
import { popIn } from '../animations';
import { useCloseOnScroll } from '../../../hooks/useCloseOnScroll';
import { useOverlayScrollLock } from '../../../hooks/useOverlayScrollLock';

// ===========================
// Context
// ===========================

interface SearchDropdownContextValue {
    isOpen: boolean;
    close: () => void;
}

const SearchDropdownContext = createContext<SearchDropdownContextValue | null>(null);

function useSearchDropdownContext() {
    const context = useContext(SearchDropdownContext);
    if (!context) {
        throw new Error('SearchDropdown compound components must be used within SearchDropdown');
    }
    return context;
}

export interface SearchDropdownProps {
    /** Controlled open state */
    open: boolean;
    /** Called when open state should change */
    onOpenChange: (open: boolean) => void;
    /**
     * Refs to elements that should NOT trigger close when clicked.
     * Useful for clear buttons, action buttons within the anchor, etc.
     */
    ignoreCloseRefs?: React.RefObject<HTMLElement>[];
    /**
     * CSS selectors for elements that should NOT trigger close.
     * Alternative to ignoreCloseRefs when refs aren't available.
     */
    ignoreCloseSelectors?: string[];
    /** When false, disables the close-on-scroll behavior */
    closeOnScroll?: boolean;
    /** Side offset from anchor (default: 4) */
    sideOffset?: number;
    /** Content alignment relative to anchor */
    align?: 'start' | 'center' | 'end';
    /** The anchor element (search input container) */
    anchor: React.ReactNode;
    /** Max width of the popover container. Without this, the container matches the anchor width
     *  which can create invisible click-blocking areas if the visible content is narrower. */
    maxWidth?: number;
    /** The dropdown content */
    children: React.ReactNode;
}

export function SearchDropdown({
    open,
    onOpenChange,
    ignoreCloseRefs = [],
    ignoreCloseSelectors = [],
    closeOnScroll = true,
    sideOffset = 4,
    align = 'start',
    anchor,
    maxWidth,
    children,
}: SearchDropdownProps) {
    const anchorWrapperRef = useRef<HTMLDivElement>(null);

    // Close handler that checks if click should be ignored
    const handlePointerDownOutside = useCallback(
        (event: Event) => {
            const target = event.target as HTMLElement;
            if (!target) return;

            // Check if target is within any of the ignore refs
            for (const ref of ignoreCloseRefs) {
                if (ref.current?.contains(target)) {
                    event.preventDefault();
                    return;
                }
            }

            // Check if target matches any ignore selectors
            for (const selector of ignoreCloseSelectors) {
                if (target.closest(selector)) {
                    event.preventDefault();
                    return;
                }
            }

            // Check if target is within the anchor wrapper
            if (anchorWrapperRef.current?.contains(target)) {
                event.preventDefault();
                return;
            }

            // Allow close for clicks truly outside
            onOpenChange(false);
        },
        [ignoreCloseRefs, ignoreCloseSelectors, onOpenChange]
    );

    // Close on scroll via shared hook
    useCloseOnScroll(
        open && closeOnScroll,
        () => onOpenChange(false)
    );

    // Close on escape key
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onOpenChange(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onOpenChange]);

    const contextValue: SearchDropdownContextValue = {
        isOpen: open,
        close: () => onOpenChange(false),
    };

    // Clamp popover width: use anchor width, but cap at maxWidth if specified
    const anchorWidth = anchorWrapperRef.current?.offsetWidth;
    const popoverWidth = anchorWidth && maxWidth
        ? Math.min(anchorWidth, maxWidth)
        : anchorWidth;

    return (
        <SearchDropdownContext.Provider value={contextValue}>
            <RadixPopover.Root open={open} onOpenChange={() => { /* Controlled externally */ }}>
                {/* Wrap the anchor content - this positions the popover */}
                <RadixPopover.Anchor asChild>
                    <div ref={anchorWrapperRef} className="search-dropdown-anchor">
                        {anchor}
                    </div>
                </RadixPopover.Anchor>

                {open && (
                    <RadixPopover.Portal>
                        <RadixPopover.Content
                            side="bottom"
                            sideOffset={sideOffset}
                            align={align}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onCloseAutoFocus={(e) => e.preventDefault()}
                            onPointerDownOutside={handlePointerDownOutside}
                            onInteractOutside={(e) => e.preventDefault()}
                            onEscapeKeyDown={(e) => {
                                e.preventDefault();
                                onOpenChange(false);
                            }}
                            style={{
                                width: popoverWidth,
                                outline: 'none',
                                zIndex: 50, // Above GridStack items (z ~10), below Modal (z-[100])
                            }}
                            asChild
                        >
                            <motion.div
                                variants={popIn}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                            >
                                {children}
                            </motion.div>
                        </RadixPopover.Content>
                    </RadixPopover.Portal>
                )}
            </RadixPopover.Root>
        </SearchDropdownContext.Provider>
    );
}

// ===========================
// SearchDropdown.Content
// ===========================

export interface SearchDropdownContentProps {
    children: React.ReactNode;
    className?: string;
    /** Max height before scrolling (default: 300px) */
    maxHeight?: number | string;
    /** Min width of dropdown (default: 280px) */
    minWidth?: number | string;
    /** Max width of dropdown (default: none) */
    maxWidth?: number | string;
}

const SearchDropdownContent = forwardRef<HTMLDivElement, SearchDropdownContentProps>(
    (
        {
            children,
            className = '',
            maxHeight = 300,
            minWidth = 280,
            maxWidth,
        },
        ref
    ) => {
        const maxHeightValue = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;
        const minWidthValue = typeof minWidth === 'number' ? `${minWidth}px` : minWidth;
        const maxWidthValue = maxWidth
            ? typeof maxWidth === 'number'
                ? `${maxWidth}px`
                : maxWidth
            : undefined;

        const contentRef = useRef<HTMLDivElement>(null);

        // Prevent touch scroll from bleeding through
        useOverlayScrollLock(true, contentRef);

        return (
            <div
                ref={(node) => {
                    // Assign to both refs
                    (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                    if (typeof ref === 'function') ref(node);
                    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
                }}
                className={`
                    z-[150]
                    bg-theme-primary border border-theme rounded-2xl
                    shadow-xl
                    p-2
                    overflow-y-auto
                    custom-scrollbar
                    ${className}
                `}
                style={{
                    maxHeight: maxHeightValue,
                    minWidth: minWidthValue,
                    maxWidth: maxWidthValue,
                    overscrollBehavior: 'contain',
                }}
            // Scroll containment handled by useOverlayScrollLock on the parent
            >
                {children}
            </div>
        );
    }
);

SearchDropdownContent.displayName = 'SearchDropdown.Content';

// ===========================
// SearchDropdown.Section
// ===========================

export interface SearchDropdownSectionProps {
    children: React.ReactNode;
    /** Header text for this section */
    header?: React.ReactNode;
    className?: string;
}

const SearchDropdownSection = forwardRef<HTMLDivElement, SearchDropdownSectionProps>(
    ({ children, header, className = '' }, ref) => {
        return (
            <div ref={ref} className={`search-dropdown-section ${className}`}>
                {header && (
                    <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-theme-tertiary px-2 py-1">
                        {header}
                    </div>
                )}
                {children}
            </div>
        );
    }
);

SearchDropdownSection.displayName = 'SearchDropdown.Section';

// ===========================
// SearchDropdown.Item
// ===========================

export interface SearchDropdownItemProps {
    children: React.ReactNode;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
    /** When true, closes the dropdown after click */
    closeOnClick?: boolean;
    disabled?: boolean;
}

const SearchDropdownItem = forwardRef<HTMLButtonElement, SearchDropdownItemProps>(
    ({ children, className = '', onClick, closeOnClick = false, disabled = false }, ref) => {
        const { close } = useSearchDropdownContext();

        const handleClick = (e: React.MouseEvent) => {
            if (disabled) return;
            onClick?.(e);
            if (closeOnClick) {
                close();
            }
        };

        return (
            <button
                ref={ref}
                type="button"
                className={`
                    flex items-center justify-between w-full
                    px-3 py-2
                    text-left text-sm text-theme-primary
                    rounded-md
                    transition-colors
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-theme-hover cursor-pointer'}
                    ${className}
                `}
                onClick={handleClick}
                disabled={disabled}
            >
                {children}
            </button>
        );
    }
);

SearchDropdownItem.displayName = 'SearchDropdown.Item';

// ===========================
// SearchDropdown.Empty
// ===========================

export interface SearchDropdownEmptyProps {
    children: React.ReactNode;
    className?: string;
}

const SearchDropdownEmpty = forwardRef<HTMLDivElement, SearchDropdownEmptyProps>(
    ({ children, className = '' }, ref) => {
        return (
            <div
                ref={ref}
                className={`
                    py-4 px-3
                    text-center text-sm text-theme-tertiary
                    ${className}
                `}
            >
                {children}
            </div>
        );
    }
);

SearchDropdownEmpty.displayName = 'SearchDropdown.Empty';

// ===========================
// SearchDropdown.Loading
// ===========================

export interface SearchDropdownLoadingProps {
    children?: React.ReactNode;
    className?: string;
}

const SearchDropdownLoading = forwardRef<HTMLDivElement, SearchDropdownLoadingProps>(
    ({ children, className = '' }, ref) => {
        return (
            <div
                ref={ref}
                className={`
                    flex items-center justify-center gap-2
                    py-4 px-3
                    text-sm text-theme-tertiary
                    ${className}
                `}
            >
                {children || 'Loading...'}
            </div>
        );
    }
);

SearchDropdownLoading.displayName = 'SearchDropdown.Loading';

// ===========================
// Attach compound components
// ===========================

SearchDropdown.Content = SearchDropdownContent;
SearchDropdown.Section = SearchDropdownSection;
SearchDropdown.Item = SearchDropdownItem;
SearchDropdown.Empty = SearchDropdownEmpty;
SearchDropdown.Loading = SearchDropdownLoading;

export {
    SearchDropdownContent,
    SearchDropdownSection,
    SearchDropdownItem,
    SearchDropdownEmpty,
    SearchDropdownLoading,
};

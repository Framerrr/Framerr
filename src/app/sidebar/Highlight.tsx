

import * as React from 'react';
import { AnimatePresence, motion, type Transition } from 'framer-motion';

// Simplified Highlight primitive for sidebar indicator
// Adapted from Animate UI: https://animate-ui.com
// Now supports two modes:
// - 'parent' (default): Single indicator element at parent level, animates position/size
// - 'children': Each item renders its own indicator, shares layoutId for smooth animation

type HighlightMode = 'parent' | 'children';

type Bounds = {
    top: number;
    left: number;
    width: number;
    height: number;
};

type HighlightContextType = {
    activeValue: string | null;
    setActiveValue: (value: string | null) => void;
    setBounds: (rect: DOMRect) => void;
    clearBounds: () => void;
    hover: boolean;
    enabled: boolean;
    transition: Transition;
    exitDelay: number;
    hoverLeaveDelay: number;
    hoverLeaveTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    mode: HighlightMode;
    contextId: string;
    indicatorClassName: string;
    indicatorStyle?: React.CSSProperties;
};

const HighlightContext = React.createContext<HighlightContextType | undefined>(undefined);

function useHighlight(): HighlightContextType {
    const context = React.useContext(HighlightContext);
    if (!context) {
        throw new Error('useHighlight must be used within a Highlight component');
    }
    return context;
}

// Default spring transition for smooth animations
const defaultTransition: Transition = {
    type: 'spring',
    stiffness: 350,
    damping: 35
};

type HighlightProps = {
    children: React.ReactNode;
    /** CSS class for the indicator element */
    className?: string;
    /** Inline styles for the indicator element */
    style?: React.CSSProperties;
    /** Whether to activate on hover (vs click) */
    hover?: boolean;
    /** Whether the highlight is enabled */
    enabled?: boolean;
    /** Animation transition config */
    transition?: Transition;
    /** Delay in ms before indicator fades out */
    exitDelay?: number;
    /** Delay in ms before hover state clears when leaving an item */
    hoverLeaveDelay?: number;
    /** Additional class for the container */
    containerClassName?: string;
    /** Bounds offset for fine-tuning indicator position (parent mode only) */
    boundsOffset?: Partial<Bounds>;
    /** Controlled active value */
    value?: string | null;
    /** Default active value (uncontrolled) */
    defaultValue?: string | null;
    /** Callback when active value changes */
    onValueChange?: (value: string | null) => void;
    /** Animation mode: 'parent' for single indicator, 'children' for per-item indicators with layoutId */
    mode?: HighlightMode;
    /** Ref to scrollable container for visibility detection (parent mode) */
    scrollContainerRef?: React.RefObject<HTMLElement | null>;
    /** Delay before fading out when item scrolls out of view (ms) */
    scrollFadeDelay?: number;
};

function Highlight({
    children,
    className = '',
    style,
    hover = true,
    enabled = true,
    transition = defaultTransition,
    exitDelay = 200,
    hoverLeaveDelay = 0,
    containerClassName = '',
    boundsOffset,
    value,
    defaultValue,
    onValueChange,
    mode = 'children',
    scrollContainerRef,
    scrollFadeDelay = 150,
}: HighlightProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const hoverLeaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const contextId = React.useId();

    // Bounds offset with defaults (for parent mode)
    const offsetTop = boundsOffset?.top ?? 0;
    const offsetLeft = boundsOffset?.left ?? 0;
    const offsetWidth = boundsOffset?.width ?? 0;
    const offsetHeight = boundsOffset?.height ?? 0;

    // State
    const [activeValue, setActiveValueState] = React.useState<string | null>(
        value ?? defaultValue ?? null
    );
    const [bounds, setBoundsState] = React.useState<Bounds | null>(null);

    // Scroll clip bounds state (parent mode)
    const [scrollClipBounds, setScrollClipBounds] = React.useState<{ top: number; bottom: number } | null>(null);

    // Track if mouse is hovering the container (for clip-path decision)
    const [isContainerHovered, setIsContainerHovered] = React.useState(false);

    // Controlled vs uncontrolled - when setting to null, fall back to defaultValue
    const setActiveValue = React.useCallback((newValue: string | null) => {
        const resolvedValue = newValue ?? defaultValue ?? null;
        if (value === undefined) {
            setActiveValueState(resolvedValue);
        }
        onValueChange?.(resolvedValue);
    }, [value, defaultValue, onValueChange]);

    // Sync with controlled value
    React.useEffect(() => {
        if (value !== undefined) {
            setActiveValueState(value);
        }
    }, [value]);

    // Sync with defaultValue changes (e.g., when navigating to a different page)
    React.useEffect(() => {
        if (defaultValue !== undefined && value === undefined) {
            // Clear any pending hover-leave timeout to prevent snap-back to old value
            if (hoverLeaveTimeoutRef.current) {
                clearTimeout(hoverLeaveTimeoutRef.current);
                hoverLeaveTimeoutRef.current = null;
            }
            setActiveValueState(defaultValue);
        }
    }, [defaultValue, value]);

    // Calculate bounds relative to container (for parent mode)
    const setBounds = React.useCallback((rect: DOMRect) => {
        if (!containerRef.current || mode !== 'parent') return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const newBounds: Bounds = {
            top: rect.top - containerRect.top + offsetTop,
            left: rect.left - containerRect.left + offsetLeft,
            width: rect.width + offsetWidth,
            height: rect.height + offsetHeight,
        };

        setBoundsState(prev => {
            if (prev &&
                prev.top === newBounds.top &&
                prev.left === newBounds.left &&
                prev.width === newBounds.width &&
                prev.height === newBounds.height) {
                return prev;
            }
            return newBounds;
        });
    }, [mode, offsetTop, offsetLeft, offsetWidth, offsetHeight]);

    const clearBounds = React.useCallback(() => {
        setBoundsState(null);
    }, []);

    // Handle scroll to update bounds (parent mode only)
    React.useEffect(() => {
        if (mode !== 'parent') return;
        const container = containerRef.current;
        if (!container || !activeValue) return;

        const onScroll = () => {
            const activeEl = container.querySelector<HTMLElement>(
                `[data-highlight-value="${activeValue}"]`
            );
            if (activeEl) {
                setBounds(activeEl.getBoundingClientRect());
            }
        };

        container.addEventListener('scroll', onScroll, { passive: true });
        return () => container.removeEventListener('scroll', onScroll);
    }, [mode, activeValue, setBounds]);

    // Track scroll container bounds for clip-path (parent mode)
    React.useEffect(() => {
        if (mode !== 'parent' || !scrollContainerRef?.current || !containerRef.current) {
            setScrollClipBounds(null);
            return;
        }

        const scrollContainer = scrollContainerRef.current;
        const container = containerRef.current;

        const updateClipBounds = () => {
            const containerRect = container.getBoundingClientRect();
            const scrollRect = scrollContainer.getBoundingClientRect();
            setScrollClipBounds({
                top: scrollRect.top - containerRect.top,
                bottom: scrollRect.bottom - containerRect.top,
            });
        };

        // Initial calculation
        updateClipBounds();

        // Update on scroll (in case container moves)
        scrollContainer.addEventListener('scroll', updateClipBounds, { passive: true });
        window.addEventListener('resize', updateClipBounds, { passive: true });

        return () => {
            scrollContainer.removeEventListener('scroll', updateClipBounds);
            window.removeEventListener('resize', updateClipBounds);
        };
    }, [mode, scrollContainerRef]);

    const contextValue = React.useMemo<HighlightContextType>(() => ({
        activeValue,
        setActiveValue,
        setBounds,
        clearBounds,
        hover,
        enabled,
        transition,
        exitDelay,
        hoverLeaveDelay,
        hoverLeaveTimeoutRef,
        mode,
        contextId,
        indicatorClassName: className,
        indicatorStyle: style,
    }), [activeValue, setActiveValue, setBounds, clearBounds, hover, enabled, transition, exitDelay, hoverLeaveDelay, mode, contextId, className, style]);

    if (!enabled) {
        return <>{children}</>;
    }

    return (
        <HighlightContext.Provider value={contextValue}>
            <div
                ref={containerRef}
                className={containerClassName}
                style={{ position: 'relative' }}
                onMouseEnter={() => setIsContainerHovered(true)}
                onMouseLeave={() => {
                    setIsContainerHovered(false);
                    // When leaving the container entirely, immediately snap back (no delay)
                    if (hoverLeaveTimeoutRef.current) {
                        clearTimeout(hoverLeaveTimeoutRef.current);
                        hoverLeaveTimeoutRef.current = null;
                    }
                    setActiveValue(null);
                }}
            >
                {/* Parent mode: Single indicator with location-based clipping */}
                {mode === 'parent' && (() => {
                    // Determine if active item is inside the scroll container
                    // If inside → apply clip-path (clips with scroll)
                    // If outside (footer) → no clip-path
                    let isActiveInScrollContainer = false;
                    if (scrollContainerRef?.current && containerRef.current && activeValue) {
                        const activeEl = containerRef.current.querySelector<HTMLElement>(
                            `[data-highlight-value="${activeValue}"]`
                        );
                        if (activeEl) {
                            isActiveInScrollContainer = scrollContainerRef.current.contains(activeEl);
                        }
                    }

                    // Calculate clip-path only for items inside scroll container
                    let clipPath: string | undefined;
                    if (isActiveInScrollContainer && scrollClipBounds && bounds) {
                        // Indicator position (relative to container)
                        const indicatorTop = bounds.top;
                        const indicatorBottom = bounds.top + bounds.height;

                        // Visible scroll area (relative to container)
                        const visibleTop = scrollClipBounds.top;
                        const visibleBottom = scrollClipBounds.bottom;

                        // Calculate how much indicator extends OUTSIDE visible area
                        // Clip from top if indicator extends above visible top
                        const clipFromTop = Math.max(0, visibleTop - indicatorTop);
                        // Clip from bottom if indicator extends below visible bottom
                        const clipFromBottom = Math.max(0, indicatorBottom - visibleBottom);

                        // Only apply clip if there's something to clip
                        if (clipFromTop > 0 || clipFromBottom > 0) {
                            clipPath = `inset(${clipFromTop}px 0 ${clipFromBottom}px 0)`;
                        }
                    }

                    // Shared layoutId for smooth animation
                    const layoutId = `highlight-indicator-${contextId}`;

                    return (
                        <AnimatePresence initial={false}>
                            {bounds && (
                                <motion.div
                                    data-highlight-indicator
                                    layoutId={layoutId}
                                    initial={{ opacity: 0 }}
                                    animate={{
                                        top: bounds.top,
                                        left: bounds.left,
                                        width: bounds.width,
                                        height: bounds.height,
                                        opacity: 1
                                    }}
                                    exit={{ opacity: 0 }}
                                    transition={transition}
                                    className={className}
                                    style={{
                                        position: 'absolute',
                                        pointerEvents: 'none',
                                        zIndex: 0,
                                        clipPath,
                                        ...style
                                    }}
                                />
                            )}
                        </AnimatePresence>
                    );
                })()}
                {/* Children mode: Each HighlightItem renders its own indicator */}
                {children}
            </div>
        </HighlightContext.Provider>
    );
}

type HighlightItemProps = {
    children: React.ReactNode;
    /** Unique value for this item */
    value: string;
    /** Whether this item is disabled */
    disabled?: boolean;
    /** Additional className for the wrapper */
    className?: string;
};

function HighlightItem({
    children,
    value,
    disabled = false,
    className = '',
}: HighlightItemProps) {
    const itemRef = React.useRef<HTMLDivElement>(null);
    const {
        activeValue,
        setActiveValue,
        setBounds,
        clearBounds,
        hover,
        enabled,
        mode,
        contextId,
        transition,
        exitDelay,
        indicatorClassName,
        indicatorStyle,
    } = useHighlight();

    const isActive = activeValue === value;

    // Parent mode: Update bounds when this item becomes active
    React.useEffect(() => {
        if (mode !== 'parent') return;
        if (isActive && itemRef.current) {
            setBounds(itemRef.current.getBoundingClientRect());
        } else if (!activeValue) {
            clearBounds();
        }
    }, [mode, isActive, activeValue, setBounds, clearBounds]);

    // Parent mode: Handle resize with RAF polling
    React.useEffect(() => {
        if (mode !== 'parent' || !isActive || !itemRef.current) return;

        let rafId: number | null = null;
        let isPolling = false;
        let pollEndTimeout: ReturnType<typeof setTimeout> | null = null;

        const updateBounds = () => {
            if (itemRef.current) {
                setBounds(itemRef.current.getBoundingClientRect());
            }
        };

        const pollPosition = () => {
            updateBounds();
            if (isPolling) {
                rafId = requestAnimationFrame(pollPosition);
            }
        };

        const startPolling = () => {
            if (!isPolling) {
                isPolling = true;
                pollPosition();
            }
            if (pollEndTimeout) clearTimeout(pollEndTimeout);
            pollEndTimeout = setTimeout(() => {
                isPolling = false;
                if (rafId) cancelAnimationFrame(rafId);
            }, 500);
        };

        const resizeObserver = new ResizeObserver(startPolling);
        resizeObserver.observe(itemRef.current);

        return () => {
            isPolling = false;
            if (rafId) cancelAnimationFrame(rafId);
            if (pollEndTimeout) clearTimeout(pollEndTimeout);
            resizeObserver.disconnect();
        };
    }, [mode, isActive, setBounds]);

    if (!enabled) {
        return <>{children}</>;
    }

    // Get hoverLeaveDelay and timeout ref from context
    const { hoverLeaveDelay, hoverLeaveTimeoutRef } = useHighlight();

    const handlers = hover && !disabled
        ? {
            onMouseEnter: () => {
                if (hoverLeaveTimeoutRef.current) {
                    clearTimeout(hoverLeaveTimeoutRef.current);
                    hoverLeaveTimeoutRef.current = null;
                }
                setActiveValue(value);
            },
            onMouseLeave: () => {
                if (hoverLeaveDelay > 0) {
                    hoverLeaveTimeoutRef.current = setTimeout(() => {
                        setActiveValue(null);
                        hoverLeaveTimeoutRef.current = null;
                    }, hoverLeaveDelay);
                } else {
                    setActiveValue(null);
                }
            },
        }
        : {};

    return (
        <div
            ref={itemRef}
            data-highlight-value={value}
            data-highlight-active={isActive}
            data-highlight-disabled={disabled}
            className={`${className} ${mode === 'children' ? 'relative' : ''}`}
            style={{ position: 'relative', zIndex: 1 }}
            {...handlers}
        >
            {/* Children mode: Render indicator inside each item with shared layoutId */}
            {mode === 'children' && isActive && !disabled && (
                <motion.div
                    layoutId={`highlight-indicator-${contextId}`}
                    data-highlight-indicator
                    className={indicatorClassName}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 0,
                        pointerEvents: 'none',
                        ...indicatorStyle,
                    }}
                    transition={transition}
                />
            )}
            {/* Content sits above indicator */}
            <div style={{ position: 'relative', zIndex: 1 }}>
                {children}
            </div>
        </div>
    );
}

export { Highlight, HighlightItem, useHighlight };
export type { HighlightProps, HighlightItemProps };

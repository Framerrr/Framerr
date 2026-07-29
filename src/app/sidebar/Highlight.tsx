

import * as React from 'react';
import { AnimatePresence, motion, useSpring, useTransform, type Transition } from 'framer-motion';

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
    registerItem: (value: string, el: HTMLElement) => () => void;
    trackActiveItem: () => void;
    hover: boolean;
    enabled: boolean;
    transition: Transition;
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
    damping: 35,
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
    hoverLeaveDelay = 0,
    containerClassName = '',
    boundsOffset,
    value,
    defaultValue,
    onValueChange,
    mode = 'children',
    scrollContainerRef,
}: HighlightProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const hoverLeaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const contextId = React.useId();

    const offsetTop = boundsOffset?.top ?? 0;
    const offsetLeft = boundsOffset?.left ?? 0;
    const offsetWidth = boundsOffset?.width ?? 0;
    const offsetHeight = boundsOffset?.height ?? 0;

    const [activeValue, setActiveValueState] = React.useState<string | null>(
        value ?? defaultValue ?? null
    );
    const [hasTarget, setHasTarget] = React.useState(false);

    const itemsRef = React.useRef(new Map<string, HTMLElement>());
    const [registryVersion, bumpRegistry] = React.useReducer((x: number) => x + 1, 0);

    const scrollClipRef = React.useRef<{ top: number; bottom: number } | null>(null);
    const isActiveInScrollContainerRef = React.useRef(false);
    const lastCommandedTargetRef = React.useRef<Bounds | null>(null);
    const previousTargetValueRef = React.useRef<string | null>(null);
    const wasHiddenRef = React.useRef(true);

    const springConfig =
        transition.type === 'spring'
            ? {
                  stiffness: transition.stiffness ?? 350,
                  damping: transition.damping ?? 35,
                  mass: transition.mass ?? 1,
              }
            : { stiffness: 350, damping: 35, mass: 1 };

    const top = useSpring(0, springConfig);
    const left = useSpring(0, springConfig);
    const width = useSpring(0, springConfig);
    const height = useSpring(0, springConfig);

    const setActiveValue = React.useCallback(
        (newValue: string | null) => {
            const resolvedValue = newValue ?? defaultValue ?? null;
            if (value === undefined) {
                setActiveValueState(resolvedValue);
            }
            onValueChange?.(resolvedValue);
        },
        [value, defaultValue, onValueChange]
    );

    React.useEffect(() => {
        if (value !== undefined) {
            setActiveValueState(value);
        }
    }, [value]);

    React.useEffect(() => {
        if (defaultValue !== undefined && value === undefined) {
            if (hoverLeaveTimeoutRef.current) {
                clearTimeout(hoverLeaveTimeoutRef.current);
                hoverLeaveTimeoutRef.current = null;
            }
            setActiveValueState(defaultValue);
        }
    }, [defaultValue, value]);

    const measureTarget = React.useCallback(
        (el: HTMLElement): Bounds => {
            if (!containerRef.current) {
                return { top: 0, left: 0, width: 0, height: 0 };
            }
            const containerRect = containerRef.current.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            // Scale-correct: aside may be Framer-scaled; ratios cancel for local CSS px
            const scaleX = containerRect.width / (containerRef.current.offsetWidth || 1) || 1;
            const scaleY = containerRect.height / (containerRef.current.offsetHeight || 1) || 1;
            return {
                top: (elRect.top - containerRect.top) / scaleY + offsetTop,
                left: (elRect.left - containerRect.left) / scaleX + offsetLeft,
                width: elRect.width / scaleX + offsetWidth,
                height: elRect.height / scaleY + offsetHeight,
            };
        },
        [offsetTop, offsetLeft, offsetWidth, offsetHeight]
    );

    const targetsEqual = (a: Bounds, b: Bounds): boolean =>
        Math.abs(a.top - b.top) <= 0.5 &&
        Math.abs(a.left - b.left) <= 0.5 &&
        Math.abs(a.width - b.width) <= 0.5 &&
        Math.abs(a.height - b.height) <= 0.5;

    const retarget = React.useCallback(
        (el: HTMLElement, { snap }: { snap: boolean }) => {
            const target = measureTarget(el);
            const last = lastCommandedTargetRef.current;
            if (last && targetsEqual(last, target)) return;

            if (snap) {
                top.jump(target.top);
                left.jump(target.left);
                width.jump(target.width);
                height.jump(target.height);
            } else {
                top.set(target.top);
                left.set(target.left);
                width.set(target.width);
                height.set(target.height);
            }
            lastCommandedTargetRef.current = target;
        },
        [measureTarget, top, left, width, height]
    );

    const registerItem = React.useCallback(
        (itemValue: string, el: HTMLElement) => {
            itemsRef.current.set(itemValue, el);
            bumpRegistry();
            return () => {
                const current = itemsRef.current.get(itemValue);
                if (current === el) {
                    itemsRef.current.delete(itemValue);
                    bumpRegistry();
                }
            };
        },
        []
    );

    const trackActiveItem = React.useCallback(() => {
        if (mode !== 'parent') return;
        const targetValue =
            value !== undefined
                ? value
                : activeValue ?? defaultValue ?? null;
        if (!targetValue) return;
        const el = itemsRef.current.get(targetValue);
        if (!el) return;
        retarget(el, { snap: true });
    }, [mode, value, activeValue, defaultValue, retarget]);

    const resolveTargetValue = React.useCallback((): string | null => {
        if (value !== undefined) {
            if (value === null) return null;
            return itemsRef.current.has(value) ? value : null;
        }
        if (activeValue && itemsRef.current.has(activeValue)) return activeValue;
        if (defaultValue && itemsRef.current.has(defaultValue)) return defaultValue;
        return null;
    }, [value, activeValue, defaultValue]);

    // Parent mode: resolve target on registry / value changes (ghost fix + controlled fallback)
    React.useLayoutEffect(() => {
        if (mode !== 'parent') return;

        const resolved = resolveTargetValue();

        if (value === undefined && resolved !== activeValue) {
            setActiveValueState(resolved);
        }

        const prevTargetValue = previousTargetValueRef.current;

        if (resolved === null) {
            wasHiddenRef.current = true;
            previousTargetValueRef.current = null;
            setHasTarget(false);
            return;
        }

        const el = itemsRef.current.get(resolved)!;
        isActiveInScrollContainerRef.current = scrollContainerRef?.current
            ? scrollContainerRef.current.contains(el)
            : false;

        const snap =
            wasHiddenRef.current ||
            (prevTargetValue !== null && !itemsRef.current.has(prevTargetValue));

        if (snap && wasHiddenRef.current) {
            const target = measureTarget(el);
            top.jump(target.top);
            left.jump(target.left);
            width.jump(target.width);
            height.jump(target.height);
            lastCommandedTargetRef.current = target;
            wasHiddenRef.current = false;
            previousTargetValueRef.current = resolved;
            setHasTarget(true);
        } else if (snap) {
            retarget(el, { snap: true });
            wasHiddenRef.current = false;
            previousTargetValueRef.current = resolved;
            setHasTarget(true);
        } else {
            retarget(el, { snap: false });
            wasHiddenRef.current = false;
            previousTargetValueRef.current = resolved;
            setHasTarget(true);
        }
    }, [
        mode,
        registryVersion,
        activeValue,
        defaultValue,
        value,
        resolveTargetValue,
        measureTarget,
        retarget,
        scrollContainerRef,
        top,
        left,
        width,
        height,
    ]);

    // Morph height / boundsOffset changes — spring retarget
    React.useLayoutEffect(() => {
        if (mode !== 'parent' || !hasTarget) return;
        const resolved = resolveTargetValue();
        if (!resolved) return;
        const el = itemsRef.current.get(resolved);
        if (el) retarget(el, { snap: false });
    }, [
        mode,
        offsetTop,
        offsetLeft,
        offsetWidth,
        offsetHeight,
        hasTarget,
        resolveTargetValue,
        retarget,
    ]);

    // Scroll: snap tracking write
    React.useEffect(() => {
        if (mode !== 'parent') return;
        const container = containerRef.current;
        if (!container) return;

        const onScroll = () => {
            trackActiveItem();
        };

        container.addEventListener('scroll', onScroll, { passive: true });
        return () => container.removeEventListener('scroll', onScroll);
    }, [mode, trackActiveItem]);

    // Scroll clip bounds (ref) + resize re-measure
    React.useEffect(() => {
        if (mode !== 'parent' || !scrollContainerRef?.current || !containerRef.current) {
            scrollClipRef.current = null;
            return;
        }

        const scrollContainer = scrollContainerRef.current;
        const container = containerRef.current;

        const updateClipBounds = () => {
            const containerRect = container.getBoundingClientRect();
            const scrollRect = scrollContainer.getBoundingClientRect();
            scrollClipRef.current = {
                top: scrollRect.top - containerRect.top,
                bottom: scrollRect.bottom - containerRect.top,
            };
            trackActiveItem();
        };

        updateClipBounds();
        scrollContainer.addEventListener('scroll', updateClipBounds, { passive: true });
        window.addEventListener('resize', updateClipBounds, { passive: true });

        return () => {
            scrollContainer.removeEventListener('scroll', updateClipBounds);
            window.removeEventListener('resize', updateClipBounds);
        };
    }, [mode, scrollContainerRef, trackActiveItem]);

    const clipPath = useTransform([top, height], ([t, h]) => {
        if (!isActiveInScrollContainerRef.current || !scrollClipRef.current) {
            return 'none';
        }
        const clipBounds = scrollClipRef.current;
        const indicatorTop = t as number;
        const indicatorBottom = indicatorTop + (h as number);
        const visibleTop = clipBounds.top;
        const visibleBottom = clipBounds.bottom;
        const clipFromTop = Math.max(0, visibleTop - indicatorTop);
        const clipFromBottom = Math.max(0, indicatorBottom - visibleBottom);
        if (clipFromTop > 0 || clipFromBottom > 0) {
            return `inset(${clipFromTop}px 0 ${clipFromBottom}px 0)`;
        }
        return 'none';
    });

    const contextValue = React.useMemo<HighlightContextType>(
        () => ({
            activeValue,
            setActiveValue,
            registerItem,
            trackActiveItem,
            hover,
            enabled,
            transition,
            hoverLeaveDelay,
            hoverLeaveTimeoutRef,
            mode,
            contextId,
            indicatorClassName: className,
            indicatorStyle: style,
        }),
        [
            activeValue,
            setActiveValue,
            registerItem,
            trackActiveItem,
            hover,
            enabled,
            transition,
            hoverLeaveDelay,
            mode,
            contextId,
            className,
            style,
        ]
    );

    if (!enabled) {
        return <>{children}</>;
    }

    return (
        <HighlightContext.Provider value={contextValue}>
            <div
                ref={containerRef}
                className={containerClassName}
                style={{ position: 'relative' }}
                onMouseLeave={() => {
                    if (hoverLeaveTimeoutRef.current) {
                        clearTimeout(hoverLeaveTimeoutRef.current);
                        hoverLeaveTimeoutRef.current = null;
                    }
                    setActiveValue(null);
                }}
            >
                {mode === 'parent' && (
                    <AnimatePresence initial={false}>
                        {hasTarget && (
                            <motion.div
                                data-highlight-indicator
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className={className}
                                style={{
                                    position: 'absolute',
                                    top,
                                    left,
                                    width,
                                    height,
                                    pointerEvents: 'none',
                                    zIndex: 0,
                                    clipPath,
                                    ...style,
                                }}
                            />
                        )}
                    </AnimatePresence>
                )}
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
    /** Stacking order relative to the parent-mode indicator (default 1) */
    zIndex?: number;
};

function HighlightItem({
    children,
    value,
    disabled = false,
    className = '',
    zIndex = 1,
}: HighlightItemProps) {
    const itemRef = React.useRef<HTMLDivElement>(null);
    const {
        activeValue,
        setActiveValue,
        registerItem,
        trackActiveItem,
        hover,
        enabled,
        mode,
        contextId,
        transition,
        indicatorClassName,
        indicatorStyle,
        hoverLeaveDelay,
        hoverLeaveTimeoutRef,
    } = useHighlight();

    const isActive = activeValue === value;

    React.useLayoutEffect(() => {
        if (mode !== 'parent' || !itemRef.current) return;
        return registerItem(value, itemRef.current);
    }, [mode, value, registerItem]);

    // Parent mode: active-value changes retarget via Highlight resolution effect.
    // ResizeObserver poll — render-free tracking (300 ms window).
    React.useEffect(() => {
        if (mode !== 'parent' || !isActive || !itemRef.current) return;

        let rafId: number | null = null;
        let isPolling = false;
        let pollEndTimeout: ReturnType<typeof setTimeout> | null = null;

        const pollPosition = () => {
            trackActiveItem();
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
            }, 300);
        };

        const resizeObserver = new ResizeObserver(startPolling);
        resizeObserver.observe(itemRef.current);

        return () => {
            isPolling = false;
            if (rafId) cancelAnimationFrame(rafId);
            if (pollEndTimeout) clearTimeout(pollEndTimeout);
            resizeObserver.disconnect();
        };
    }, [mode, isActive, trackActiveItem]);

    if (!enabled) {
        return <>{children}</>;
    }

    const handlers =
        hover && !disabled
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
            style={{ position: 'relative', zIndex }}
            {...handlers}
        >
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
            <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
        </div>
    );
}

export { Highlight, HighlightItem };
export type { HighlightProps, HighlightItemProps };

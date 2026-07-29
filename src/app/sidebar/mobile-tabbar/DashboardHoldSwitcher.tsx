import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Home, Plus } from 'lucide-react';
import { indicatorSurfaceStyle, sidebarSpring } from '@/app/sidebar/types';
import { useActiveDashboard } from '@/context/ActiveDashboardContext';
import { useSharedSidebar } from '@/app/sidebar/context/useSharedSidebar';
import { LoadingSpinner } from '@/shared/ui';
import { triggerHaptic } from '@/utils/haptics';

const VIEWPORT_MARGIN = 16;

export type HoldSwitcherCommit =
    | { type: 'dashboard'; id: string }
    | { type: 'new' };

export interface DashboardHoldSwitcherHandle {
    updatePointer: (clientX: number, clientY: number) => void;
    rebuildRowCache: () => void;
    requestClose: () => void;
    /**
     * On finger lift: if a row is highlighted, select + close (slide-to-switch).
     * If nothing highlighted, leave open for tap selection.
     */
    releasePointer: () => void;
}

export interface DashboardHoldSwitcherProps {
    anchorRect: DOMRect;
    onClose: () => void;
    /** Fires when the close morph begins (chrome may restore on a short delay). */
    onCloseStart?: () => void;
    /** Row chosen via tap (or accessible click). Closes after invoke. */
    onSelect: (result: HoldSwitcherCommit) => void;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function computeTargetGeometry(anchorRect: DOMRect, contentHeight: number): {
    top: number;
    left: number;
    width: number;
    height: number;
} {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const safeAreaTop = 0;
    const width = Math.min(320, vw - 2 * VIEWPORT_MARGIN);
    const maxHeight = Math.min(
        contentHeight,
        0.5 * vh,
        anchorRect.top - VIEWPORT_MARGIN - safeAreaTop,
    );
    const height = Math.max(120, maxHeight);
    const left = clamp(
        anchorRect.left + anchorRect.width / 2 - width / 2,
        VIEWPORT_MARGIN,
        vw - VIEWPORT_MARGIN - width,
    );
    const top = anchorRect.bottom - height;
    return { top, left, width, height };
}

export const DashboardHoldSwitcher = forwardRef<DashboardHoldSwitcherHandle, DashboardHoldSwitcherProps>(
    function DashboardHoldSwitcher({ anchorRect, onClose, onCloseStart, onSelect }, ref) {
        const { dashboards, homeDashboardId, activeDashboardId, isLoading } = useActiveDashboard();
        const { renderIcon } = useSharedSidebar();
        const scrollRef = useRef<HTMLDivElement>(null);
        const surfaceRef = useRef<HTMLDivElement>(null);
        const contentRef = useRef<HTMLDivElement>(null);
        const rowRectsRef = useRef<Map<string, DOMRect>>(new Map());
        const [highlightedId, setHighlightedId] = useState<string | 'new' | null>(null);
        const highlightedIdRef = useRef<string | 'new' | null>(null);
        const [open, setOpen] = useState(true);
        const lastHighlightRef = useRef<string | 'new' | null>(null);
        const closeStartedRef = useRef(false);

        const setHighlight = useCallback((id: string | 'new' | null): void => {
            highlightedIdRef.current = id;
            setHighlightedId(id);
        }, []);

        const beginClose = useCallback((): void => {
            if (closeStartedRef.current) return;
            closeStartedRef.current = true;
            // Clear list/header before the next paint — empty pill morphs back over the tab slot.
            if (contentRef.current) {
                contentRef.current.style.visibility = 'hidden';
                contentRef.current.style.opacity = '0';
            }
            onCloseStart?.();
            setOpen(false);
        }, [onCloseStart]);

        const selectAndClose = useCallback(
            (result: HoldSwitcherCommit): void => {
                onSelect(result);
                beginClose();
            },
            [onSelect, beginClose],
        );

        // Active dashboard last — release near the bottom is intentional, not accidental.
        const orderedDashboards = useMemo(() => {
            const current = dashboards.filter(d => d.id === activeDashboardId);
            const others = dashboards.filter(d => d.id !== activeDashboardId);
            return [...others, ...current];
        }, [dashboards, activeDashboardId]);

        const rowCount = orderedDashboards.length + 1;
        const estimatedContentHeight = rowCount * 48 + 56;

        const target = useMemo(
            () => computeTargetGeometry(anchorRect, estimatedContentHeight),
            [anchorRect, estimatedContentHeight],
        );

        const rebuildRowCache = useCallback((): void => {
            const map = new Map<string, DOMRect>();
            const root = scrollRef.current;
            if (!root) {
                rowRectsRef.current = map;
                return;
            }
            root.querySelectorAll<HTMLElement>('[data-switcher-id]').forEach(el => {
                const id = el.dataset.switcherId;
                if (id) {
                    map.set(id, el.getBoundingClientRect());
                }
            });
            rowRectsRef.current = map;
        }, []);

        useLayoutEffect(() => {
            if (!open) return;
            const t = window.setTimeout(rebuildRowCache, 320);
            return () => window.clearTimeout(t);
        }, [open, dashboards.length, rebuildRowCache]);

        const updatePointer = useCallback(
            (clientX: number, clientY: number): void => {
                rebuildRowCache();
                let hit: string | 'new' | null = null;
                for (const [id, rect] of rowRectsRef.current.entries()) {
                    if (
                        clientX >= rect.left &&
                        clientX <= rect.right &&
                        clientY >= rect.top &&
                        clientY <= rect.bottom
                    ) {
                        hit = id;
                        break;
                    }
                }

                if (hit !== lastHighlightRef.current) {
                    if (hit) {
                        triggerHaptic('light');
                    }
                    lastHighlightRef.current = hit;
                    setHighlight(hit);
                }

                const scrollEl = scrollRef.current;
                const surface = surfaceRef.current;
                if (scrollEl && surface && rowRectsRef.current.size > 0) {
                    const surfaceRect = surface.getBoundingClientRect();
                    const rowHeight = 48;
                    if (clientY < surfaceRect.top + 24) {
                        scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop - rowHeight);
                    } else if (clientY > surfaceRect.bottom - 24) {
                        scrollEl.scrollTop += rowHeight;
                    }
                }
            },
            [rebuildRowCache, setHighlight],
        );

        const releasePointer = useCallback((): void => {
            const hit = highlightedIdRef.current;
            if (hit === 'new') {
                selectAndClose({ type: 'new' });
                return;
            }
            if (hit && dashboards.some(d => d.id === hit)) {
                selectAndClose({ type: 'dashboard', id: hit });
            }
            // No highlight → stay open for tap / outside dismiss
        }, [dashboards, selectAndClose]);

        useImperativeHandle(ref, () => ({
            updatePointer,
            rebuildRowCache,
            requestClose: beginClose,
            releasePointer,
        }), [updatePointer, rebuildRowCache, beginClose, releasePointer]);

        useEffect(() => {
            return () => {
                lastHighlightRef.current = null;
            };
        }, []);

        const handleExitComplete = (): void => {
            onClose();
        };

        const rowClass = (isHighlighted: boolean, emphasized = false): string =>
            `w-[calc(100%-1.25rem)] mx-2.5 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                emphasized ? 'font-medium' : ''
            } text-theme-primary ${isHighlighted ? 'bg-accent/20 text-accent' : ''}`;

        return (
            <AnimatePresence onExitComplete={handleExitComplete}>
                {open && (
                    <>
                        <motion.div
                            key="hold-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 z-[51]"
                            onClick={beginClose}
                        />
                        <motion.div
                            ref={surfaceRef}
                            key="hold-surface"
                            initial={{
                                top: anchorRect.top,
                                left: anchorRect.left,
                                width: anchorRect.width,
                                height: anchorRect.height,
                                borderRadius: 14,
                                opacity: 1,
                            }}
                            animate={{
                                top: target.top,
                                left: target.left,
                                width: target.width,
                                height: target.height,
                                borderRadius: 20,
                                opacity: 1,
                            }}
                            exit={{
                                top: anchorRect.top,
                                left: anchorRect.left,
                                width: anchorRect.width,
                                height: anchorRect.height,
                                borderRadius: 14,
                                // Fade late so chrome under the pill can crossfade in (visible, not a snap).
                                opacity: 0,
                            }}
                            transition={{
                                top: sidebarSpring,
                                left: sidebarSpring,
                                width: sidebarSpring,
                                height: sidebarSpring,
                                borderRadius: sidebarSpring,
                                opacity: { duration: 0.2, delay: 0.12, ease: 'easeOut' },
                            }}
                            className="fixed z-[52] overflow-hidden shadow-lg"
                            style={{
                                ...indicatorSurfaceStyle,
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                userSelect: 'none',
                            }}
                            onContextMenu={e => e.preventDefault()}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* contentRef is hard-hidden in beginClose so exit morph is an empty pill */}
                            <div ref={contentRef} className="h-full">
                            <p className="text-xs font-medium text-theme-tertiary uppercase tracking-wider px-4 pt-4 pb-1">
                                Switch dashboard
                            </p>
                            <div
                                ref={scrollRef}
                                className="overflow-y-auto pb-3"
                                style={{ maxHeight: target.height - 40 }}
                                onScroll={rebuildRowCache}
                            >
                                {isLoading ? (
                                    <div className="flex justify-center py-4">
                                        <LoadingSpinner size="sm" />
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            data-switcher-id="new"
                                            className={rowClass(highlightedId === 'new', true)}
                                            onPointerEnter={() => setHighlight('new')}
                                            onClick={() => {
                                                triggerHaptic('light');
                                                selectAndClose({ type: 'new' });
                                            }}
                                        >
                                            <Plus size={16} className="text-accent" />
                                            New Dashboard
                                        </button>
                                        {/* border-accent reads on the indicator-tinted surface; theme-hover blends into noir */}
                                        <div
                                            className="h-px my-2 mx-4"
                                            style={{ backgroundColor: 'var(--border-accent)' }}
                                        />
                                        {orderedDashboards.map(d => {
                                            const isActive = d.id === activeDashboardId;
                                            const isHighlighted = highlightedId === d.id;
                                            return (
                                                <button
                                                    key={d.id}
                                                    type="button"
                                                    data-switcher-id={d.id}
                                                    className={rowClass(isHighlighted)}
                                                    onPointerEnter={() => setHighlight(d.id)}
                                                    onClick={() => {
                                                        triggerHaptic('light');
                                                        selectAndClose({ type: 'dashboard', id: d.id });
                                                    }}
                                                >
                                                    <span className="flex-1 truncate text-left flex items-center gap-2 min-w-0">
                                                        <span className="shrink-0 text-theme-tertiary">
                                                            {renderIcon(d.icon || 'LayoutDashboard', 16)}
                                                        </span>
                                                        <span className="truncate">{d.name}</span>
                                                        {d.id === homeDashboardId && (
                                                            <Home
                                                                size={12}
                                                                className="text-theme-tertiary shrink-0"
                                                                aria-label="Home"
                                                            />
                                                        )}
                                                    </span>
                                                    {isActive && (
                                                        <Check size={16} className="text-accent shrink-0" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        );
    },
);

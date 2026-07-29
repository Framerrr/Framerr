import React, { useEffect, useLayoutEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, UserCircle, Mail, LayoutGrid, Settings as SettingsIcon, PanelLeftClose, ChevronDown } from 'lucide-react';
import { DashboardPicker } from './DashboardPicker';
import { NewDashboardModal } from '@/app/dashboard/components/NewDashboardModal';
import { isAlreadyOnDashboardPage } from './dashboardNavUtils';
import { useActiveDashboard } from '@/context/ActiveDashboardContext';
import { useSharedSidebar } from '@/app/sidebar/context/useSharedSidebar';
import { Highlight, HighlightItem } from '@/app/sidebar/Highlight';
import { sidebarSpring, highlightSpring, indicatorSurfaceStyle } from '@/app/sidebar/types';
import { NotificationCenter } from '../../features/notifications';
import { triggerHaptic } from '@/utils/haptics';
import { SidebarTabsContent } from '@/app/sidebar/SidebarTabsContent';
import { SidebarSettingsContent } from '@/app/sidebar/SidebarSettingsContent';
import { BetaBadge } from '@/shared/ui/BetaBadge';
import { guardedNavigate } from '@/settings/navigation';

type DashboardPickerOverlayBox = {
    top: number;
    left: number;
    width: number;
    rowHeight: number;
};

/** Same insets as Highlight boundsOffset (left: 8, width: -16) */
const DASHBOARD_PICKER_INSET = 8;
/** Match mobile tab bar hold-to-switch timing */
const DASHBOARD_HOLD_MS = 350;
const DASHBOARD_HOLD_MOVE_CANCEL_PX = 8;

/**
 * Desktop Sidebar Component
 * Collapsible sidebar with hover indicator animation
 */
export function DesktopSidebar() {
    // Ref for scrollable nav container (for indicator visibility detection)
    const navScrollRef = React.useRef<HTMLElement>(null);
    // Ref to track pending mode reset timeout (so we can cancel it when user clicks toggle)
    const modeResetTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    // Ref to debounce auto-hide on mouse leave (prevents flicker during animation)
    const hideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    // Pointer over the aside — used so dropdown portal doesn't collapse the sidebar
    const pointerOverSidebarRef = React.useRef(false);
    /**
     * Touch/pen pointerdown sets this so the subsequent synthesized mouseenter
     * does not auto-expand — condensed tab taps can navigate without expanding.
     * Cleared on mouseleave so real mouse hover-expand still works.
     */
    const suppressHoverExpandRef = React.useRef(false);
    const asideRef = React.useRef<HTMLElement | null>(null);
    const dashboardAnchorRef = React.useRef<HTMLDivElement>(null);
    const dashboardHoldTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const dashboardHoldTriggeredRef = React.useRef(false);
    const dashboardHoldStartRef = React.useRef<{ x: number; y: number } | null>(null);
    /** Open switcher after expand animation settles (hold-from-condensed path). */
    const pendingOpenDashboardPickerRef = React.useRef(false);
    const dashboardPickerOverlayRef = React.useRef<HTMLDivElement>(null);
    const sidebarFooterRef = React.useRef<HTMLDivElement>(null);
    const [dashboardMenuOpen, setDashboardMenuOpen] = useState(false);
    const dashboardMenuOpenRef = React.useRef(false);
    const [newDashboardOpen, setNewDashboardOpen] = useState(false);
    const [dashboardPickerBox, setDashboardPickerBox] = useState<DashboardPickerOverlayBox | null>(null);
    /** Cap list so it stops above the footer instead of clipping into it */
    const [dashboardPickerMaxHeight, setDashboardPickerMaxHeight] = useState(0);
    /** Target list height (content measure) — drives Highlight boundsOffset */
    const [dashboardPickerListHeight, setDashboardPickerListHeight] = useState(0);
    /**
     * Stays true from open through close spring so the list overlay can track the
     * indicator until it returns to row size.
     */
    const [dashboardPickerMorphActive, setDashboardPickerMorphActive] = useState(false);
    const [asideSettled, setAsideSettled] = useState(true);
    const dashboardPickerContentRef = React.useRef<HTMLDivElement>(null);

    const setDashboardMenuOpenSafe = (open: boolean): void => {
        dashboardMenuOpenRef.current = open;
        setDashboardMenuOpen(open);
        if (open) {
            setDashboardPickerMorphActive(true);
        }
    };

    const { activeDashboardId, dashboards } = useActiveDashboard();
    const activeDashboard = dashboards.find(d => d.id === activeDashboardId);
    const activeDashboardName = activeDashboard?.name?.trim() || 'Dashboard';
    const activeDashboardIcon = activeDashboard?.icon || 'LayoutDashboard';

    const {
        isExpanded,
        setIsExpanded,
        isSidebarHidden,
        setSidebarHidden,
        currentUser,
        showNotificationCenter,
        setShowNotificationCenter,
        serverName,
        serverIcon,
        unreadCount,
        dashboardEdit,
        hoverTimeoutRef,
        handleNavigation,
        handleLogout,
        renderIcon,
        getActiveNavItem,
        sidebarMode,
        setSidebarMode,
        lastSettingsPath,
    } = useSharedSidebar();

    // Peek intent for edge-hover interaction when sidebar is hidden
    const [peekIntent, setPeekIntent] = useState(false);
    const isPeeking = peekIntent && isSidebarHidden;

    // Auto-collapse sidebar when entering edit mode
    useEffect(() => {
        if (dashboardEdit?.editMode && isExpanded) {
            queueMicrotask(() => setIsExpanded(false));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Effect must collapse only on edit-mode transition
    }, [dashboardEdit?.editMode]);

    // Parse current route for active state detection
    const hash = window.location.hash.slice(1);

    const activeNavItem = getActiveNavItem();

    // When collapsed, settings sub-tabs aren't visible, so snap indicator to parent category
    const effectiveActiveNavItem = React.useMemo(() => {
        if (!isExpanded && activeNavItem.startsWith('settings-')) {
            const parts = activeNavItem.split('-');
            if (parts.length >= 3) {
                return `settings-${parts[1]}`;
            }
        }
        return activeNavItem;
    }, [isExpanded, activeNavItem]);

    // Determine if sidebar is in hidden-off-screen state
    // Settings pages override: sidebar is always visible
    const isOnSettingsPage = hash.startsWith('settings');
    const effectivelyHidden = isSidebarHidden && !isOnSettingsPage && !isPeeking && !isExpanded;

    const openDashboardPicker = (): void => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        // Morph geometry is wrong while width is still 80→280 — expand first, then open.
        if (!isExpanded) {
            pendingOpenDashboardPickerRef.current = true;
            setAsideSettled(false);
            setIsExpanded(true);
            return;
        }
        if (!asideSettled) {
            pendingOpenDashboardPickerRef.current = true;
            return;
        }
        setDashboardMenuOpenSafe(true);
    };

    // Finish deferred hold-open once the sidebar width spring has settled
    useEffect(() => {
        if (!isExpanded) {
            pendingOpenDashboardPickerRef.current = false;
            return;
        }
        if (!pendingOpenDashboardPickerRef.current || !asideSettled) return;
        pendingOpenDashboardPickerRef.current = false;
        setDashboardMenuOpenSafe(true);
    }, [isExpanded, asideSettled]);

    const clearDashboardHold = (): void => {
        if (dashboardHoldTimerRef.current) {
            clearTimeout(dashboardHoldTimerRef.current);
            dashboardHoldTimerRef.current = null;
        }
        dashboardHoldStartRef.current = null;
    };

    const handleDashboardHoldPointerDown = (e: React.PointerEvent): void => {
        // Primary button / touch only
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        dashboardHoldTriggeredRef.current = false;
        clearDashboardHold();
        dashboardHoldStartRef.current = { x: e.clientX, y: e.clientY };
        dashboardHoldTimerRef.current = setTimeout(() => {
            dashboardHoldTimerRef.current = null;
            dashboardHoldTriggeredRef.current = true;
            triggerHaptic('light');
            openDashboardPicker();
        }, DASHBOARD_HOLD_MS);
    };

    const handleDashboardHoldPointerMove = (e: React.PointerEvent): void => {
        const start = dashboardHoldStartRef.current;
        if (!start || dashboardHoldTriggeredRef.current) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.hypot(dx, dy) > DASHBOARD_HOLD_MOVE_CANCEL_PX) {
            clearDashboardHold();
        }
    };

    const handleDashboardHoldPointerEnd = (): void => {
        clearDashboardHold();
    };

    const closeDashboardPicker = (): void => {
        setDashboardMenuOpenSafe(false);
        if (!pointerOverSidebarRef.current && !isOnSettingsPage) {
            if (isSidebarHidden) {
                hideTimeoutRef.current = setTimeout(() => {
                    if (pointerOverSidebarRef.current) return;
                    setIsExpanded(false);
                    setPeekIntent(false);
                    hideTimeoutRef.current = null;
                }, 100);
            } else if (!showNotificationCenter) {
                setIsExpanded(false);
            }
        }
    };

    const cancelDashboardPickerMorph = (): void => {
        dashboardMenuOpenRef.current = false;
        setDashboardMenuOpen(false);
        setDashboardPickerMorphActive(false);
        setDashboardPickerBox(null);
        setDashboardPickerListHeight(0);
    };

    // Force sidebar visible when navigating to settings
    useEffect(() => {
        if (isOnSettingsPage && isSidebarHidden) {
            queueMicrotask(() => setIsExpanded(true));
        }
    }, [isOnSettingsPage, isSidebarHidden, setIsExpanded]);

    // List geometry: same insets as Highlight boundsOffset (anchor-based, not animated indicator)
    useLayoutEffect(() => {
        if (!dashboardPickerMorphActive) return;

        const updateBox = (): void => {
            const anchor = dashboardAnchorRef.current;
            const aside = asideRef.current;
            if (!anchor || !aside || aside.offsetWidth === 0) return;
            // Prefer HighlightItem wrapper — same rect Highlight uses for the indicator
            const item =
                (aside.querySelector('[data-highlight-value="dashboard"]') as HTMLElement | null) ||
                anchor;
            const a = item.getBoundingClientRect();
            const s = aside.getBoundingClientRect();
            // aside uses Framer scale transforms — convert viewport deltas into local CSS px
            const scaleX = s.width / aside.offsetWidth || 1;
            const scaleY = s.height / aside.offsetHeight || 1;
            setDashboardPickerBox({
                top: (a.top - s.top) / scaleY,
                left: (a.left - s.left) / scaleX + DASHBOARD_PICKER_INSET,
                width: Math.max(0, a.width / scaleX - DASHBOARD_PICKER_INSET * 2),
                rowHeight: a.height / scaleY,
            });

            // Stop above notifications/profile/settings/logout — never grow into the footer
            const footer = sidebarFooterRef.current;
            const gap = 8;
            const hardCap = 24 * 16; // 24rem
            if (footer) {
                const available = (footer.getBoundingClientRect().top - a.bottom) / scaleY - gap;
                setDashboardPickerMaxHeight(Math.max(0, Math.min(hardCap, available)));
            } else {
                setDashboardPickerMaxHeight(hardCap);
            }
        };

        updateBox();
        const raf = requestAnimationFrame(updateBox);
        window.addEventListener('resize', updateBox);
        const nav = navScrollRef.current;
        nav?.addEventListener('scroll', updateBox, { passive: true });
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', updateBox);
            nav?.removeEventListener('scroll', updateBox);
        };
    }, [dashboardPickerMorphActive, dashboardMenuOpen, isExpanded]);

    // Measure list content → target height for the Highlight indicator grow
    useLayoutEffect(() => {
        if (!dashboardMenuOpen) return;
        const content = dashboardPickerContentRef.current;
        if (!content) return;

        const updateHeight = (): void => {
            const raw = content.scrollHeight;
            const capped =
                dashboardPickerMaxHeight > 0 ? Math.min(raw, dashboardPickerMaxHeight) : raw;
            setDashboardPickerListHeight(Math.max(0, capped));
        };
        updateHeight();
        const ro = new ResizeObserver(updateHeight);
        ro.observe(content);
        return () => ro.disconnect();
    }, [dashboardMenuOpen, dashboardPickerBox, dashboardPickerMaxHeight]);

    // Mirror indicator height onto the transparent list clip (one spring — no second surface)
    useLayoutEffect(() => {
        if (!dashboardPickerMorphActive || !dashboardPickerBox) return;
        const aside = asideRef.current;
        if (!aside) return;

        const rowHeight = dashboardPickerBox.rowHeight;
        let rafId = 0;
        let active = true;
        const sync = (): void => {
            if (!active) return;
            const indicator = aside.querySelector('[data-highlight-indicator]') as HTMLElement | null;
            const overlay = dashboardPickerOverlayRef.current;
            if (!indicator && dashboardPickerMorphActive) {
                active = false;
                dashboardMenuOpenRef.current = false;
                setDashboardMenuOpen(false);
                setDashboardPickerMorphActive(false);
                setDashboardPickerBox(null);
                setDashboardPickerListHeight(0);
                return;
            }
            if (indicator && overlay && aside.offsetHeight > 0) {
                const scaleY = aside.getBoundingClientRect().height / aside.offsetHeight || 1;
                const indH = indicator.getBoundingClientRect().height / scaleY;
                const extra = Math.max(0, indH - rowHeight);
                overlay.style.height = `${extra}px`;

                if (!dashboardMenuOpenRef.current && extra <= 0.5) {
                    active = false;
                    setDashboardPickerBox(null);
                    setDashboardPickerMorphActive(false);
                    setDashboardPickerListHeight(0);
                    return;
                }
            }
            rafId = requestAnimationFrame(sync);
        };
        rafId = requestAnimationFrame(sync);
        return () => {
            active = false;
            cancelAnimationFrame(rafId);
        };
    }, [dashboardPickerMorphActive, dashboardPickerBox]);

    // Close on outside click / Escape
    useEffect(() => {
        if (!dashboardMenuOpen) return;

        const onPointerDown = (e: PointerEvent): void => {
            const target = e.target as Node | null;
            if (target && dashboardPickerOverlayRef.current?.contains(target)) return;
            if (target && dashboardAnchorRef.current?.contains(target)) return;
            closeDashboardPicker();
        };
        const onKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') closeDashboardPicker();
        };

        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('keydown', onKeyDown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- rebind when open toggles
    }, [dashboardMenuOpen]);


    // Calculate sidebar position and scale
    // Hidden: off-screen (-96px), Peeking: 30% visible (-56px), Normal: full position (16px)
    const isPeekOnly = isPeeking && !isExpanded && isSidebarHidden;
    const sidebarLeft = effectivelyHidden ? -96 : (isPeekOnly ? -56 : 16);
    const sidebarScale = effectivelyHidden ? 0.95 : 1;
    const sidebarOpacity = effectivelyHidden ? 0 : 1;

    return (
        <>
            {/* Peek zone — disabled when sidebar is fully open */}
            {isSidebarHidden && !isOnSettingsPage && (
                <div
                    style={{
                        position: 'fixed',
                        left: 6,
                        top: 0,
                        width: 36,
                        height: '100%',
                        zIndex: 50,
                        pointerEvents: isExpanded ? 'none' : 'auto',
                    }}
                    onMouseEnter={() => {
                        setPeekIntent(true);
                    }}
                    onMouseLeave={() => {
                        setPeekIntent(false);
                    }}
                    onClick={() => {
                        if (isPeeking) {
                            setIsExpanded(true);
                        }
                    }}
                />
            )}
            {/* Snap open zone (screen edge) — disabled when sidebar is fully open */}
            {isSidebarHidden && !isOnSettingsPage && (
                <div
                    style={{
                        position: 'fixed',
                        left: 0,
                        top: 0,
                        width: 12,
                        height: '100%',
                        zIndex: 51,
                        pointerEvents: isExpanded ? 'none' : 'auto',
                    }}
                    onMouseEnter={() => {
                        if (hideTimeoutRef.current) {
                            clearTimeout(hideTimeoutRef.current);
                            hideTimeoutRef.current = null;
                        }
                        setPeekIntent(true);
                        setIsExpanded(true);
                    }}
                />
            )}

            {/* Bridge div — fills the gap between screen edge and floating sidebar when expanded in auto-hide mode */}
            {isSidebarHidden && !isOnSettingsPage && isExpanded && (
                <div
                    style={{
                        position: 'fixed',
                        left: 0,
                        top: 16,
                        width: 16,
                        height: 'calc(100vh - 32px)',
                        zIndex: 40,
                    }}
                    onMouseEnter={() => {
                        // Mouse in the gap — cancel any pending hide
                        if (hideTimeoutRef.current) {
                            clearTimeout(hideTimeoutRef.current);
                            hideTimeoutRef.current = null;
                        }
                    }}
                    onMouseLeave={() => {
                        // Mouse left the gap — start hide timer (skip while dashboard picker is open)
                        if (dashboardMenuOpenRef.current) return;
                        hideTimeoutRef.current = setTimeout(() => {
                            if (dashboardMenuOpenRef.current || pointerOverSidebarRef.current) return;
                            setIsExpanded(false);
                            setPeekIntent(false);
                            hideTimeoutRef.current = null;
                        }, 300);
                    }}
                />
            )}

            {/* Backdrop when sidebar is expanded (skip on settings — sidebar is always open there) */}
            <AnimatePresence>
                {isExpanded && !isOnSettingsPage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={sidebarSpring}
                        className="fixed inset-0 bg-black/20 z-30 pointer-events-none"
                    />
                )}
            </AnimatePresence>

            <motion.aside
                ref={asideRef}
                className="glass-card sidebar-shadow flex flex-col relative fade-in"
                animate={{
                    width: showNotificationCenter ? 400 : (isExpanded ? 280 : 80),
                    left: sidebarLeft,
                    scale: sidebarScale,
                    opacity: sidebarOpacity,
                }}
                transition={sidebarSpring}
                onAnimationStart={() => setAsideSettled(false)}
                onAnimationComplete={() => setAsideSettled(true)}
                style={{
                    height: 'calc(100vh - 32px)',
                    position: 'fixed',
                    top: '16px',
                    zIndex: 40,
                    overflow: 'hidden',
                    borderRadius: '20px',
                    transformOrigin: 'left center',
                }}
                onPointerDown={(e) => {
                    // Touch synthesizes mouseenter before click; skip hover-expand for that path.
                    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                        suppressHoverExpandRef.current = true;
                    } else {
                        suppressHoverExpandRef.current = false;
                    }
                }}
                onMouseEnter={() => {
                    pointerOverSidebarRef.current = true;
                    // Cancel any pending hide (prevents flicker)
                    if (hideTimeoutRef.current) {
                        clearTimeout(hideTimeoutRef.current);
                        hideTimeoutRef.current = null;
                    }

                    // Don't auto-expand sidebar during dashboard edit mode
                    if (dashboardEdit?.editMode) return;

                    // When peeking, don't auto-expand — user must click to expand
                    if (isPeeking) return;

                    // Touch/pen: leave condensed so a tab tap navigates without expanding first
                    if (suppressHoverExpandRef.current) return;

                    if (!isSidebarHidden || isOnSettingsPage) {
                        // Normal behavior: expand on hover
                        setIsExpanded(true);
                    }
                }}
                onClick={() => {
                    // If peeking (collapsed strip visible), click to fully expand
                    if (isPeeking && !isExpanded) {
                        setIsExpanded(true);
                    }
                }}
                onMouseLeave={() => {
                    pointerOverSidebarRef.current = false;
                    suppressHoverExpandRef.current = false;
                    // Keep expanded while the dashboard picker dropdown is open
                    // (menu content is portaled outside the aside)
                    if (dashboardMenuOpenRef.current) return;

                    if (isSidebarHidden && !isOnSettingsPage) {
                        // Debounce auto-hide to prevent flicker during animation
                        hideTimeoutRef.current = setTimeout(() => {
                            if (dashboardMenuOpenRef.current || pointerOverSidebarRef.current) return;
                            setIsExpanded(false);
                            setPeekIntent(false);
                            hideTimeoutRef.current = null;
                        }, 100);
                    } else if (!showNotificationCenter && !isOnSettingsPage) {
                        // Normal behavior: collapse
                        setIsExpanded(false);
                    }
                    // Reset to settings mode if on a settings page (with delay to allow button clicks to register)
                    if (isOnSettingsPage) {
                        if (modeResetTimeoutRef.current) {
                            clearTimeout(modeResetTimeoutRef.current);
                        }
                        modeResetTimeoutRef.current = setTimeout(() => {
                            setSidebarMode('settings');
                            modeResetTimeoutRef.current = null;
                        }, 100);
                    }
                    // Clear any pending hover timeout when leaving sidebar
                    if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                    }
                }}
            >
                {/* Gradient border accent */}
                <div
                    className="absolute inset-0 rounded-[20px] pointer-events-none"
                    style={{
                        background: 'linear-gradient(to bottom, var(--accent-glow), var(--accent-glow-soft))',
                        WebkitMask: 'linear-gradient(black, black) padding-box, linear-gradient(black, black)',
                        WebkitMaskComposite: 'xor',
                        mask: 'linear-gradient(black, black) padding-box, linear-gradient(black, black)',
                        maskComposite: 'exclude',
                        padding: '1px',
                    }}
                />


                {/* Header - conditional based on mode */}
                {showNotificationCenter ? (
                    /* NotificationCenter has its own header */
                    null
                ) : (
                    <div className="h-20 flex items-center border-b border-theme-light text-accent font-semibold text-lg whitespace-nowrap overflow-hidden relative z-10">
                        {/* Icon — tap toggles expand (touch desktop); mouse still uses hover */}
                        <button
                            type="button"
                            className="w-20 h-full flex items-center justify-center flex-shrink-0 text-accent drop-shadow-lg bg-transparent border-0 cursor-pointer"
                            aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (dashboardEdit?.editMode) return;
                                setIsExpanded((expanded) => !expanded);
                            }}
                        >
                            {renderIcon(serverIcon, 28)}
                        </button>
                        {/* Text - appears when expanded */}
                        <AnimatePresence mode="wait">
                            {isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.1 }}
                                    className="flex flex-col flex-1 min-w-0"
                                >
                                    <span className="gradient-text font-bold">{serverName || 'Dashboard'}</span>
                                    <BetaBadge />
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {/* Auto-hide toggle button - only visible when expanded */}
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.15 }}
                                    className="mr-4 p-1.5 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
                                    title={isSidebarHidden ? 'Show Sidebar' : 'Hide Sidebar'}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSidebarHidden(!isSidebarHidden);
                                        if (!isSidebarHidden) {
                                            // Hiding: collapse and hide
                                            setIsExpanded(false);
                                            setPeekIntent(false);
                                        }
                                    }}
                                >
                                    <PanelLeftClose
                                        size={18}
                                        style={{
                                            transform: isSidebarHidden ? 'scaleX(-1)' : 'none',
                                            transition: 'transform 0.2s ease',
                                        }}
                                    />
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Navigation and Footer - wrapped in Highlight for unified indicator animation */}
                <Highlight
                    className="bg-accent/20 rounded-xl shadow-lg"
                    style={
                        dashboardPickerMorphActive
                            ? { ...indicatorSurfaceStyle, zIndex: 40 }
                            : undefined
                    }
                    containerClassName="flex flex-col flex-1 min-h-0"
                    hover
                    hoverLeaveDelay={150}
                    // Pin through close so the row pill stays put under the morphing card
                    value={dashboardPickerMorphActive ? 'dashboard' : undefined}
                    defaultValue={effectiveActiveNavItem}
                    transition={highlightSpring}
                    mode="parent"
                    boundsOffset={{
                        left: DASHBOARD_PICKER_INSET,
                        width: -DASHBOARD_PICKER_INSET * 2,
                        // Single spring (Highlight) grows/shrinks the pill; list clip mirrors it
                        height: dashboardMenuOpen ? dashboardPickerListHeight : 0,
                    }}
                    scrollContainerRef={navScrollRef}
                >
                    {/* Content Area - conditional based on mode */}
                    {showNotificationCenter ? (
                        /* NotificationCenter content - full height, no padding */
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <NotificationCenter
                                isMobile={false}
                                onClose={() => {
                                    setShowNotificationCenter(false);
                                    // Keep sidebar expanded if on settings page
                                    const isOnSettingsPage = window.location.hash.slice(1).startsWith('settings');
                                    if (!isOnSettingsPage) {
                                        setIsExpanded(false);
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <nav
                            ref={navScrollRef}
                            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 space-y-1 relative"
                            style={{ overscrollBehavior: 'contain' }}
                        >
                            {/* Mode Toggle - Tabs / Settings (only on settings page, when expanded) */}
                            {hash.startsWith('settings') && isExpanded && (
                                <div className="px-4 mb-3">
                                    <div className="flex gap-1 bg-theme-tertiary/30 p-1 rounded-lg">
                                        <button
                                            onClick={() => {
                                                // Cancel any pending mode reset from onMouseLeave
                                                if (modeResetTimeoutRef.current) {
                                                    clearTimeout(modeResetTimeoutRef.current);
                                                    modeResetTimeoutRef.current = null;
                                                }
                                                setSidebarMode('tabs');
                                            }}
                                            className="relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-1"
                                        >
                                            {sidebarMode === 'tabs' && (
                                                <motion.div
                                                    layoutId="sidebarModeIndicator"
                                                    className="absolute inset-0 bg-accent rounded-md"
                                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                                />
                                            )}
                                            <span className={`relative z-10 ${sidebarMode === 'tabs' ? 'text-white' : 'text-theme-secondary'}`}>
                                                Tabs
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => setSidebarMode('settings')}
                                            className="relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-1"
                                        >
                                            {sidebarMode === 'settings' && (
                                                <motion.div
                                                    layoutId="sidebarModeIndicator"
                                                    className="absolute inset-0 bg-accent rounded-md"
                                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                                />
                                            )}
                                            <span className={`relative z-10 ${sidebarMode === 'settings' ? 'text-white' : 'text-theme-secondary'}`}>
                                                Settings
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Dashboard row stays above the grown pill (z-40); tabs stay at default z-1 beneath it */}
                            <HighlightItem value="dashboard" zIndex={dashboardPickerMorphActive ? 50 : 1}>
                                <div
                                    ref={dashboardAnchorRef}
                                    className="relative group flex items-center min-h-[48px] rounded-xl"
                                    onPointerDown={handleDashboardHoldPointerDown}
                                    onPointerMove={handleDashboardHoldPointerMove}
                                    onPointerUp={handleDashboardHoldPointerEnd}
                                    onPointerCancel={handleDashboardHoldPointerEnd}
                                    onPointerLeave={handleDashboardHoldPointerEnd}
                                    onContextMenu={(e) => {
                                        // Avoid OS callout interfering with hold-to-switch on touch
                                        e.preventDefault();
                                    }}
                                    style={{
                                        WebkitTouchCallout: 'none',
                                        userSelect: 'none',
                                    } as React.CSSProperties}
                                >
                                    <a
                                        href={
                                            activeDashboardId
                                                ? `/#dashboard/${activeDashboardId}`
                                                : '/#dashboard'
                                        }
                                        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                                            if (dashboardHoldTriggeredRef.current) {
                                                dashboardHoldTriggeredRef.current = false;
                                                e.preventDefault();
                                                return;
                                            }
                                            if (dashboardMenuOpen) {
                                                e.preventDefault();
                                                return;
                                            }
                                            if (isAlreadyOnDashboardPage()) {
                                                e.preventDefault();
                                                document.getElementById('dashboard-layer')?.scrollTo({ top: 0, behavior: 'smooth' });
                                                return;
                                            }
                                            handleNavigation(
                                                e,
                                                activeDashboardId
                                                    ? `#dashboard/${activeDashboardId}`
                                                    : '#dashboard',
                                            );
                                        }}
                                        className={`relative flex flex-1 items-center min-w-0 py-3.5 pl-20 pr-10 min-h-[48px] text-sm font-medium transition-colors rounded-xl ${
                                            activeNavItem === 'dashboard' || dashboardMenuOpen
                                                ? 'text-accent'
                                                : 'text-theme-secondary hover:text-theme-primary'
                                        }`}
                                    >
                                        <div className="absolute left-0 w-20 h-full flex items-center justify-center">
                                            <span className={`flex items-center justify-center ${activeNavItem === 'dashboard' || dashboardMenuOpen ? 'text-accent' : ''}`}>
                                                {renderIcon(activeDashboardIcon, 20)}
                                            </span>
                                        </div>
                                        {isExpanded && (
                                            <span
                                                title={activeDashboardName}
                                                className="truncate min-w-0 pr-1"
                                            >
                                                {activeDashboardName}
                                            </span>
                                        )}
                                    </a>
                                    {isExpanded && asideSettled && (
                                    <button
                                        type="button"
                                        aria-label="Switch dashboard"
                                        aria-expanded={dashboardMenuOpen}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors transition-opacity hover:bg-[rgba(59,130,246,0.12)] active:bg-[rgba(59,130,246,0.18)] opacity-0 pointer-events-none text-theme-tertiary hover:text-theme-primary group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto focus:opacity-100 focus:pointer-events-auto"
                                        onClick={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (dashboardMenuOpen) {
                                                closeDashboardPicker();
                                            } else {
                                                openDashboardPicker();
                                            }
                                        }}
                                    >
                                        <ChevronDown
                                            size={16}
                                            className={`transition-transform duration-200 ${dashboardMenuOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    )}
                                </div>
                            </HighlightItem>

                            {/* Content Section - Conditionally render tabs or settings */}
                            {sidebarMode === 'tabs' && <SidebarTabsContent />}
                            {sidebarMode === 'settings' && <SidebarSettingsContent />}
                        </nav>
                    )}

                    {/* Footer - ALWAYS visible */}
                    <div
                        ref={sidebarFooterRef}
                        className="flex-shrink-0 py-3 border-t border-theme-light flex flex-col gap-2 relative z-[70]"
                    >
                        {/* Notifications Button */}
                        <HighlightItem value="notifications">
                            <button
                                onClick={() => {
                                    triggerHaptic('light');
                                    if (showNotificationCenter) {
                                        // Return to current sidebar mode (tabs or settings)
                                        setShowNotificationCenter(false);
                                        // sidebarMode stays the same - we go back to whatever mode we were in
                                    } else {
                                        if (dashboardMenuOpenRef.current || dashboardPickerMorphActive) {
                                            cancelDashboardPickerMorph();
                                        }
                                        setShowNotificationCenter(true);
                                    }
                                }}
                                className="relative flex items-center py-3 pl-20 min-h-[44px] text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors rounded-xl w-full"
                            >
                                {/* Icon - absolutely positioned in 80px left zone */}
                                <div className="absolute left-0 w-20 h-full flex items-center justify-center">
                                    <span className="flex items-center justify-center relative">
                                        {showNotificationCenter ? <LayoutGrid size={20} /> : <Mail size={20} />}
                                        {/* Red dot badge */}
                                        {!showNotificationCenter && unreadCount > 0 && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute -top-1 -right-1 bg-error text-white 
                                                    text-[10px] font-bold rounded-full min-w-[18px] h-[18px] 
                                                    flex items-center justify-center shadow-lg"
                                            >
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </motion.div>
                                        )}
                                    </span>
                                </div>
                                {/* Text - appears when expanded */}
                                <AnimatePresence mode="wait">
                                    {isExpanded && (
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.1 }}
                                            className="whitespace-nowrap"
                                        >
                                            {showNotificationCenter
                                                ? (hash.startsWith('settings') ? '← Back to Settings' : '← Back to Tabs')
                                                : 'Notifications'
                                            }
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>
                        </HighlightItem>

                        {/* Profile Link - navigates to settings/account/profile */}
                        <HighlightItem value="profile">
                            <a
                                href="/#settings/account/profile"
                                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavigation(e, '#settings/account/profile')}
                                className="relative flex items-center py-3 pl-20 min-h-[44px] text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors rounded-xl group"
                            >
                                {/* Icon - absolutely positioned in 80px left zone */}
                                <div className="absolute left-0 w-20 h-full flex items-center justify-center">
                                    <span className="flex items-center justify-center">
                                        {currentUser?.profilePicture ? (
                                            <img
                                                src={currentUser.profilePicture}
                                                alt="Profile"
                                                className="w-[20px] h-[20px] rounded-full object-cover border border-theme"
                                            />
                                        ) : (
                                            <UserCircle size={20} />
                                        )}
                                    </span>
                                </div>
                                {/* Text - appears when expanded */}
                                <AnimatePresence mode="wait">
                                    {isExpanded && (
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.1 }}
                                            className="whitespace-nowrap"
                                        >
                                            Profile
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                                {/* Tooltip for collapsed state */}
                                {!isExpanded && (
                                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-theme-secondary/95 backdrop-blur-sm text-theme-primary text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-theme">
                                        {currentUser?.username || 'Profile'}
                                    </div>
                                )}
                            </a>
                        </HighlightItem>

                        {/* Settings Button - navigates to settings page */}
                        <HighlightItem value="settings">
                            <button
                                onClick={() => {
                                    triggerHaptic('light');

                                    const destination = lastSettingsPath || '#settings/tabs';

                                    // Use shared guard helper
                                    const result = guardedNavigate(destination, dashboardEdit);
                                    if (result === 'blocked') return;

                                    // Navigate to last settings path or default to /tabs
                                    setSidebarMode('settings');
                                    setShowNotificationCenter(false);
                                    window.location.hash = destination;
                                }}
                                className="relative flex items-center py-3 pl-20 min-h-[44px] text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors rounded-xl w-full"
                            >
                                {/* Icon - absolutely positioned in 80px left zone */}
                                <div className="absolute left-0 w-20 h-full flex items-center justify-center">
                                    <span className="flex items-center justify-center">
                                        <SettingsIcon size={20} />
                                    </span>
                                </div>
                                {/* Text - appears when expanded */}
                                <AnimatePresence mode="wait">
                                    {isExpanded && (
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.1 }}
                                            className="whitespace-nowrap"
                                        >
                                            Settings
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>
                        </HighlightItem>

                        {/* Logout Button */}
                        <HighlightItem value="logout">
                            <button
                                onClick={handleLogout}
                                className="relative flex items-center py-3 pl-20 min-h-[44px] text-sm font-medium text-slate-400 hover:text-red-400 transition-colors rounded-xl w-full"
                            >
                                {/* Icon - absolutely positioned in 80px left zone */}
                                <div className="absolute left-0 w-20 h-full flex items-center justify-center">
                                    <span className="flex items-center justify-center">
                                        <LogOut size={20} />
                                    </span>
                                </div>
                                {/* Text - appears when expanded */}
                                <AnimatePresence mode="wait">
                                    {isExpanded && (
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.1 }}
                                            className="whitespace-nowrap"
                                        >
                                            Logout
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>
                        </HighlightItem>
                    </div>
                </Highlight>

                {/*
                  Transparent list chrome — only the Highlight pill paints.
                  Pill z-40 covers overlapping tabs; this layer is z-60 for hits/text only.
                */}
                {dashboardPickerMorphActive && isExpanded && dashboardPickerBox && (
                    <div
                        ref={dashboardPickerOverlayRef}
                        className="absolute z-[60] overflow-hidden"
                        style={{
                            top: dashboardPickerBox.top + dashboardPickerBox.rowHeight,
                            left: dashboardPickerBox.left,
                            width: dashboardPickerBox.width,
                            height: 0, // live height written each frame from the indicator
                            maxHeight: dashboardPickerMaxHeight > 0 ? dashboardPickerMaxHeight : undefined,
                            pointerEvents: dashboardMenuOpen ? 'auto' : 'none',
                        }}
                        onMouseEnter={() => {
                            pointerOverSidebarRef.current = true;
                            if (hideTimeoutRef.current) {
                                clearTimeout(hideTimeoutRef.current);
                                hideTimeoutRef.current = null;
                            }
                        }}
                    >
                        <div
                            ref={dashboardPickerContentRef}
                            className="overflow-y-auto custom-scrollbar py-1"
                            style={{
                                maxHeight: dashboardPickerMaxHeight > 0 ? dashboardPickerMaxHeight : undefined,
                            }}
                        >
                            <DashboardPicker
                                variant="list"
                                onRequestClose={closeDashboardPicker}
                                onRequestNew={() => {
                                    setDashboardMenuOpenSafe(false);
                                    setNewDashboardOpen(true);
                                }}
                            />
                        </div>
                    </div>
                )}
            </motion.aside >

            {/* Backdrop overlay when notification center is open */}
            <AnimatePresence>
                {
                    showNotificationCenter && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setShowNotificationCenter(false);
                                // Keep sidebar expanded if on settings page
                                const isOnSettingsPage = window.location.hash.slice(1).startsWith('settings');
                                if (!isOnSettingsPage) {
                                    setIsExpanded(false);
                                }
                            }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
                        />
                    )
                }
            </AnimatePresence >

            {/* Hosted outside the dropdown portal so create flow survives menu close */}
            <NewDashboardModal open={newDashboardOpen} onOpenChange={setNewDashboardOpen} />
        </>
    );
}

export default DesktopSidebar;

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LayoutDashboard, ChevronUp, LogOut, UserCircle, Mail, LayoutGrid, Settings as SettingsIcon, Undo2, Redo2, Plus, Save, Link, Unlink } from 'lucide-react';
import { useSharedSidebar } from './SharedSidebarContext';
import { sidebarSpring } from './types';
import NotificationCenter from '../notifications/NotificationCenter';
import { triggerHaptic } from '../../utils/haptics';

/**
 * Mobile Tab Bar Component
 * Bottom sheet with expandable menu and swipe-to-edit
 */
export function MobileTabBar() {
    const {
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        tabs,
        currentUser,
        showNotificationCenter,
        setShowNotificationCenter,
        userSettings,
        unreadCount,
        dashboardEdit,
        handleNavigation,
        handleLogout,
        renderIcon,
        lastSettingsPath,
    } = useSharedSidebar();

    // Swipe-to-edit confirm state
    const [showEditConfirm, setShowEditConfirm] = useState<boolean>(false);
    const [confirmExitUp, setConfirmExitUp] = useState<boolean>(false);
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const swipeStartYRef = useRef<number | null>(null);

    // Pull-to-close gesture state
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef<number | null>(null);
    const scrollableElementRef = useRef<HTMLElement | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Check if currently on Dashboard page (for swipe-to-edit feature)
    const isOnDashboard = !window.location.hash || window.location.hash === '#dashboard';

    // Parse current route for active state detection
    const hash = window.location.hash.slice(1);
    const hashParts = hash.split('?');
    const searchParams = hashParts.length > 1 ? new URLSearchParams(hashParts[1]) : new URLSearchParams();
    const currentTab = searchParams.get('tab');
    const source = searchParams.get('source');

    // Swipe-to-edit handlers
    const handleTabBarTouchStart = (e: React.TouchEvent): void => {
        // Only enable on Dashboard page when menu is closed
        if (!isOnDashboard || dashboardEdit?.editMode || isMobileMenuOpen) return;
        swipeStartYRef.current = e.touches[0].clientY;
    };

    const handleTabBarTouchMove = (e: React.TouchEvent): void => {
        if (swipeStartYRef.current === null) return;
        // Note: Cannot preventDefault here as touch events are passive by default in React
        // The touchAction: 'none' CSS property handles this instead
    };

    const handleTabBarTouchEnd = (e: React.TouchEvent): void => {
        if (swipeStartYRef.current === null) return;

        const swipeEndY = e.changedTouches[0].clientY;
        const swipeDistance = swipeStartYRef.current - swipeEndY;
        swipeStartYRef.current = null;

        // If we're in edit mode or menu is open, don't trigger
        if (dashboardEdit?.editMode || isMobileMenuOpen) return;

        // Threshold for swipe detection (upward swipe to reveal edit confirm)
        const swipeThreshold = 30;

        if (swipeDistance > swipeThreshold) {
            // Upward swipe: Show edit confirm prompt or confirm if already showing
            triggerHaptic();
            if (showEditConfirm) {
                // Second swipe confirms edit mode directly
                handleConfirmEditMode();
            } else {
                // First swipe shows confirm prompt
                setShowEditConfirm(true);

                // Auto-dismiss after 5 seconds if not acted upon
                if (confirmTimeoutRef.current) {
                    clearTimeout(confirmTimeoutRef.current);
                }
                confirmTimeoutRef.current = setTimeout(() => {
                    setShowEditConfirm(false);
                    confirmTimeoutRef.current = null;
                }, 5000);
            }
        } else if (swipeDistance < -swipeThreshold && showEditConfirm) {
            // Downward swipe: Dismiss if confirm is showing
            dismissEditConfirm();
        }
    };

    const handleConfirmEditMode = (): void => {
        if (confirmTimeoutRef.current) {
            clearTimeout(confirmTimeoutRef.current);
            confirmTimeoutRef.current = null;
        }
        // Edit controls will appear
        setConfirmExitUp(true);
        setShowEditConfirm(false);

        dashboardEdit?.handlers?.handleEnterEditMode(true); // Swipe = touch mode
        // Reset after animation
        setTimeout(() => {
            setConfirmExitUp(false);
        }, 300);

        // Clear any existing auto-dismiss timeout
        if (confirmTimeoutRef.current) {
            clearTimeout(confirmTimeoutRef.current);
            confirmTimeoutRef.current = null;
        }
    };

    const dismissEditConfirm = (): void => {
        if (confirmTimeoutRef.current) {
            clearTimeout(confirmTimeoutRef.current);
            confirmTimeoutRef.current = null;
        }
        // Nav will appear - direction computed in render phase via prevShowEditConfirmRef
        setShowEditConfirm(false);
    };

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (confirmTimeoutRef.current) {
                clearTimeout(confirmTimeoutRef.current);
            }
        };
    }, []);

    // Dismiss confirm on any tap outside (allows tap-through to underlying elements)
    useEffect(() => {
        if (!showEditConfirm) return;

        const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
            // Check if click was on the confirm button or tab bar area (allow swipe handling)
            const target = e.target as HTMLElement;
            if (target.closest('[data-edit-confirm-button]') || target.closest('[data-edit-tabbar]')) {
                return; // Don't dismiss - let the proper handler run
            }
            dismissEditConfirm();
        };

        // Use capture phase to run before other click handlers
        document.addEventListener('click', handleDocumentClick, true);
        document.addEventListener('touchend', handleDocumentClick, true);

        return () => {
            document.removeEventListener('click', handleDocumentClick, true);
            document.removeEventListener('touchend', handleDocumentClick, true);
        };
    }, [showEditConfirm]);

    // ==========================================
    // Pull-to-close gesture handlers
    // ==========================================

    // Find nearest scrollable parent element
    const findScrollableParent = (el: HTMLElement | null): HTMLElement | null => {
        while (el) {
            const style = getComputedStyle(el);
            const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll';
            const hasScroll = el.scrollHeight > el.clientHeight;
            if (isScrollable && hasScroll) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    };

    const handleContentTouchStart = (e: React.TouchEvent) => {
        if (!isMobileMenuOpen) return;

        dragStartY.current = e.touches[0].clientY;
        scrollableElementRef.current = findScrollableParent(e.target as HTMLElement);
        setIsDragging(false);
    };

    const handleContentTouchEnd = () => {
        if (!isDragging) {
            dragStartY.current = null;
            scrollableElementRef.current = null;
            return;
        }

        const threshold = 100; // pixels to trigger close

        if (dragOffset > threshold) {
            // Close the menu with haptic feedback
            triggerHaptic();
            setIsMobileMenuOpen(false);
        }

        // Reset state
        setDragOffset(0);
        setIsDragging(false);
        dragStartY.current = null;
        scrollableElementRef.current = null;
    };

    // Use non-passive touchmove for iOS compatibility (allows preventDefault)
    useEffect(() => {
        if (!isMobileMenuOpen) {
            // Reset drag state when menu closes
            setDragOffset(0);
            setIsDragging(false);
            return;
        }

        const contentEl = contentRef.current;
        if (!contentEl) return;

        const handleTouchMove = (e: TouchEvent) => {
            if (dragStartY.current === null) return;

            const currentY = e.touches[0].clientY;
            const deltaY = currentY - dragStartY.current;

            // Check if touch started on scrollable content
            const scrollEl = scrollableElementRef.current;

            if (scrollEl) {
                // Content is scrollable - check scroll position
                if (scrollEl.scrollTop > 0) {
                    // Not at top, let native scroll handle it
                    return;
                }
                // At top - if pulling down, intercept for close gesture
                if (deltaY > 0) {
                    e.preventDefault();
                    setIsDragging(true);
                    // Apply rubber-band resistance (60% of actual drag)
                    setDragOffset(Math.max(0, deltaY * 0.6));
                }
                // Pulling up at top - let scroll handle (will bounce)
            } else {
                // No scrollable parent - direct pull to close
                if (deltaY > 0) {
                    e.preventDefault();
                    setIsDragging(true);
                    setDragOffset(Math.max(0, deltaY * 0.6));
                }
            }
        };

        // Must use passive: false to allow preventDefault on iOS
        contentEl.addEventListener('touchmove', handleTouchMove, { passive: false });
        return () => contentEl.removeEventListener('touchmove', handleTouchMove);
    }, [isMobileMenuOpen]);

    return (
        <>
            {/* Backdrop */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/50 z-[49]"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Mobile menu */}
            <motion.div
                className="fixed left-4 right-4 z-50 flex flex-col"
                animate={{
                    // During drag, shrink height; otherwise use open/closed state
                    // Clamp minimum to 70px (tab bar height)
                    height: isDragging
                        ? `max(70px, calc(75vh - ${dragOffset}px))`
                        : (isMobileMenuOpen ? '75vh' : '70px'),
                    scale: isMobileMenuOpen ? 1 : 0.98,
                }}
                transition={isDragging ? { duration: 0 } : {
                    type: 'spring',
                    stiffness: 350,
                    damping: 35,
                    mass: 0.7,
                }}
                style={{
                    bottom: '1rem',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, var(--glass-start), var(--glass-end))',
                    backdropFilter: 'blur(var(--blur-strong))',
                    WebkitBackdropFilter: 'blur(var(--blur-strong))',
                    borderRadius: '20px',
                    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6), 0 12px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border-glass), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                }}
            >
                {/* Gradient border accent */}
                <div
                    className="absolute inset-0 rounded-[20px] pointer-events-none"
                    style={{
                        background: 'linear-gradient(to top, var(--accent-glow), var(--accent-glow-soft))',
                        WebkitMask: 'linear-gradient(black, black) padding-box, linear-gradient(black, black)',
                        WebkitMaskComposite: 'xor',
                        mask: 'linear-gradient(black, black) padding-box, linear-gradient(black, black)',
                        maskComposite: 'exclude',
                        padding: '1px',
                    }}
                />

                {/* Expandable content - uses flex-1 to fill space above tab bar */}
                <motion.div
                    ref={contentRef}
                    className="flex flex-col"
                    initial={false}
                    animate={{
                        opacity: isMobileMenuOpen ? 1 : 0,
                    }}
                    transition={{
                        type: 'spring',
                        stiffness: 350,
                        damping: 35,
                        mass: 0.7,
                    }}
                    style={{
                        flex: 1,
                        minHeight: 0,
                        pointerEvents: isMobileMenuOpen ? 'auto' : 'none',
                        overflow: 'hidden',
                        touchAction: 'pan-y',
                    }}
                    onTouchStart={handleContentTouchStart}
                    onTouchEnd={handleContentTouchEnd}
                >
                    {/* Content wrapper - no translateY, just flex container */}
                    <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
                        {/* STAGE - Tabs OR NotificationCenter */}
                        <AnimatePresence mode="wait">
                            {showNotificationCenter ? (
                                <motion.div
                                    key="notifications"
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -20, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                                    className="flex-1 flex flex-col"
                                    style={{ minHeight: 0 }}
                                >
                                    <NotificationCenter
                                        isMobile={true}
                                        onClose={() => setShowNotificationCenter(false)}
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="tabs"
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -20, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                                    className="flex flex-col flex-1"
                                    style={{ minHeight: 0 }}
                                    onTouchMove={(e) => e.stopPropagation()}
                                >
                                    <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-700/50">
                                        <div className="flex items-center gap-3 text-accent font-bold text-xl">
                                            {renderIcon(userSettings?.serverIcon, 24)}
                                            <span className="gradient-text">{userSettings?.serverName || 'Dashboard'}</span>
                                        </div>
                                    </div>

                                    {/* Scroll container */}
                                    <div className="flex-1 overflow-hidden">
                                        <div
                                            className={`h-full overflow-x-hidden custom-scrollbar px-6 pt-4 pb-4 ${isDragging ? 'overflow-y-hidden' : 'overflow-y-auto'}`}
                                            style={{
                                                overscrollBehavior: 'contain',
                                                WebkitOverflowScrolling: 'touch',
                                                touchAction: isDragging ? 'none' : 'pan-y'
                                            }}
                                        >
                                            <nav className="space-y-4">
                                                {tabs && tabs.length > 0 && (
                                                    <div>
                                                        <motion.div
                                                            className="text-xs font-medium text-theme-tertiary uppercase tracking-wider mb-2"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: isMobileMenuOpen ? 1 : 0 }}
                                                            transition={{
                                                                type: 'spring',
                                                                stiffness: 350,
                                                                damping: 35,
                                                            }}
                                                        >
                                                            Tabs
                                                        </motion.div>
                                                        <div className="space-y-1">
                                                            {tabs.map((tab, index) => {
                                                                const isActive = hash === tab.slug;
                                                                return (
                                                                    <motion.a
                                                                        key={tab.id}
                                                                        href={`/#${tab.slug}`}
                                                                        onClick={(e) => { handleNavigation(e, `#${tab.slug}`); if (!dashboardEdit?.editMode || !dashboardEdit?.hasUnsavedChanges) setIsMobileMenuOpen(false); }}
                                                                        className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl transition-colors relative ${isActive ? 'text-accent' : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary'}`}
                                                                        initial={{ opacity: 0 }}
                                                                        animate={{
                                                                            opacity: isMobileMenuOpen ? 1 : 0,
                                                                        }}
                                                                        transition={{
                                                                            type: 'spring',
                                                                            stiffness: 350,
                                                                            damping: 35,
                                                                        }}
                                                                        whileTap={{ scale: 0.97 }}
                                                                    >
                                                                        {/* Active Indicator for Menu List */}
                                                                        {isActive && (
                                                                            <motion.div
                                                                                layoutId="mobileTabIndicator"
                                                                                className="absolute inset-0 bg-accent/20 rounded-xl shadow-lg"
                                                                                transition={sidebarSpring}
                                                                            />
                                                                        )}

                                                                        {/* Content */}
                                                                        <div className="relative z-10 flex items-center gap-3">
                                                                            {renderIcon(tab.icon, 18)}
                                                                            <span className="font-medium">{tab.name}</span>
                                                                        </div>
                                                                    </motion.a>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </nav>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* CONTROLS - OUTSIDE AnimatePresence (no animation during view switch) */}
                        {/* Inside translateY wrapper (slides with content for uniform clipping) */}
                        <div className="px-6 pt-4 pb-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(100, 116, 139, 0.3)' }}>
                            <button
                                onClick={() => {
                                    triggerHaptic('light');
                                    setShowNotificationCenter(!showNotificationCenter);
                                }}
                                className="w-full flex items-center gap-3 py-3 px-4 rounded-lg mb-2 bg-theme-secondary/10 text-theme-primary hover:bg-theme-secondary/20 transition-colors relative"
                            >
                                <div className="relative">
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
                                </div>
                                <span className="font-medium">{showNotificationCenter ? 'Tabs' : 'Notifications'}</span>
                            </button>
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 py-3 px-4 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                            >
                                <LogOut size={20} />
                                <span className="font-medium">Logout</span>
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Tab Bar - fixed height at bottom, flex-shrink-0 */}
                <div
                    data-edit-tabbar
                    className="flex justify-around items-center px-2 overflow-hidden"
                    style={{
                        height: '70px',
                        flexShrink: 0,
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                        touchAction: 'none',
                    }}
                    onTouchStart={handleTabBarTouchStart}
                    onTouchMove={handleTabBarTouchMove}
                    onTouchEnd={handleTabBarTouchEnd}
                >
                    <AnimatePresence mode="popLayout" custom={{ confirmExitUp }}>
                        {dashboardEdit?.editMode ? (
                            /* Edit Mode Controls */
                            <motion.div
                                key="edit-controls"
                                initial={{ y: '100%', opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: '100%', opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 700, damping: 50 }}
                                className="flex justify-around items-center w-full gap-1"
                            >
                                {/* Cancel */}
                                <button
                                    onClick={() => { triggerHaptic(); dashboardEdit?.handlers?.handleCancel(); }}
                                    className="flex flex-col items-center gap-1 text-theme-secondary active:text-theme-primary transition-all py-2 px-2 rounded-lg active:bg-theme-hover min-w-[50px]"
                                >
                                    <X size={22} />
                                    <span className="text-[10px] font-medium">Cancel</span>
                                </button>

                                {/* Undo */}
                                <button
                                    onClick={() => { if (dashboardEdit?.canUndo) triggerHaptic(); dashboardEdit?.handlers?.handleUndo(); }}
                                    disabled={!dashboardEdit?.canUndo}
                                    className={`flex flex-col items-center gap-1 transition-all py-2 px-2 rounded-lg min-w-[50px]
                                        ${dashboardEdit?.canUndo
                                            ? 'text-theme-secondary active:text-theme-primary active:bg-theme-hover'
                                            : 'text-theme-tertiary opacity-50 cursor-not-allowed'
                                        }`}
                                >
                                    <Undo2 size={22} />
                                    <span className="text-[10px] font-medium">Undo</span>
                                </button>

                                {/* Redo */}
                                <button
                                    onClick={() => { if (dashboardEdit?.canRedo) triggerHaptic(); dashboardEdit?.handlers?.handleRedo(); }}
                                    disabled={!dashboardEdit?.canRedo}
                                    className={`flex flex-col items-center gap-1 transition-all py-2 px-2 rounded-lg min-w-[50px]
                                        ${dashboardEdit?.canRedo
                                            ? 'text-theme-secondary active:text-theme-primary active:bg-theme-hover'
                                            : 'text-theme-tertiary opacity-50 cursor-not-allowed'
                                        }`}
                                >
                                    <Redo2 size={22} />
                                    <span className="text-[10px] font-medium">Redo</span>
                                </button>

                                {/* Re-link (only shown when independent) */}
                                {(dashboardEdit?.mobileLayoutMode === 'independent' || dashboardEdit?.pendingUnlink) && (
                                    <button
                                        onClick={() => { triggerHaptic(); dashboardEdit?.handlers?.handleRelink(); }}
                                        className="flex flex-col items-center gap-1 text-accent active:text-accent/80 transition-all py-2 px-2 rounded-lg active:bg-accent/20 min-w-[50px]"
                                    >
                                        <Link size={22} />
                                        <span className="text-[10px] font-medium">Relink</span>
                                    </button>
                                )}

                                {/* Add Widget */}
                                <button
                                    onClick={() => { triggerHaptic(); dashboardEdit?.handlers?.handleAddWidget(); }}
                                    className="flex flex-col items-center gap-1 text-accent active:text-accent/80 transition-all py-2 px-2 rounded-lg active:bg-accent/20 min-w-[50px]"
                                >
                                    <Plus size={22} />
                                    <span className="text-[10px] font-medium">Add</span>
                                </button>

                                {/* Save */}
                                <button
                                    onClick={() => { if (dashboardEdit?.hasUnsavedChanges && !dashboardEdit?.saving) triggerHaptic(); dashboardEdit?.handlers?.handleSave(); }}
                                    disabled={!dashboardEdit?.hasUnsavedChanges || dashboardEdit?.saving}
                                    className={`flex flex-col items-center gap-1 transition-all py-2 px-2 rounded-lg min-w-[50px]
                                        ${dashboardEdit?.hasUnsavedChanges && !dashboardEdit?.saving
                                            ? 'text-accent active:text-accent/80 active:bg-accent/20'
                                            : 'text-theme-tertiary opacity-50 cursor-not-allowed'
                                        }`}
                                >
                                    <Save size={22} />
                                    <span className="text-[10px] font-medium">{dashboardEdit?.saving ? 'Saving' : 'Save'}</span>
                                </button>
                            </motion.div>
                        ) : showEditConfirm ? (
                            /* Edit Confirm Prompt */
                            <motion.div
                                key="edit-confirm"
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                variants={{
                                    hidden: { y: '100%', opacity: 0 },
                                    visible: { y: 0, opacity: 1 },
                                    exit: (custom: { confirmExitUp?: boolean } | undefined) => ({ y: custom?.confirmExitUp ? '-100%' : '100%', opacity: 0 })
                                }}
                                transition={{ type: 'spring', stiffness: 700, damping: 50 }}
                                className="flex justify-center items-center w-full"
                            >
                                <button
                                    data-edit-confirm-button
                                    onClick={handleConfirmEditMode}
                                    className="flex items-center gap-3 px-6 py-3 rounded-xl bg-accent/20 text-accent active:bg-accent/30 transition-all"
                                    style={{
                                        WebkitTouchCallout: 'none',
                                        WebkitUserSelect: 'none',
                                        userSelect: 'none',
                                    }}
                                >
                                    <LayoutDashboard size={22} />
                                    <span className="text-sm font-semibold">Edit Dashboard?</span>
                                    <ChevronUp size={18} className="animate-bounce" />
                                </button>
                            </motion.div>
                        ) : (
                            /* Navigation Mode - Original Tab Bar */
                            <motion.div
                                key="nav-buttons"
                                initial={{ y: '-100%', opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: '-100%', opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 700, damping: 50 }}
                                className="flex justify-around items-center w-full"
                            >
                                <button
                                    onClick={() => { triggerHaptic(); setIsMobileMenuOpen(!isMobileMenuOpen); }}
                                    className="flex flex-col items-center gap-1 text-theme-tertiary active:text-theme-primary transition-all py-2 px-3 rounded-lg active:bg-theme-hover"
                                    style={{
                                        transition: 'transform 300ms ease-out',
                                    }}
                                >
                                    <div className="relative" style={{
                                        transition: 'transform 300ms ease-out',
                                        transform: isMobileMenuOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                    }}>
                                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                                        {/* Notification badge on hamburger icon */}
                                        {!isMobileMenuOpen && unreadCount > 0 && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute -top-1 -right-2 bg-error text-white 
                                        text-[8px] font-bold rounded-full min-w-[16px] h-[16px] 
                                        flex items-center justify-center shadow-lg"
                                            >
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </motion.div>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-medium">{isMobileMenuOpen ? 'Close' : 'Menu'}</span>
                                </button>
                                <a
                                    href="/#dashboard"
                                    onClick={(e) => {
                                        triggerHaptic();
                                        const isAlreadyOnDashboard = !window.location.hash || window.location.hash === '#dashboard';
                                        if (isAlreadyOnDashboard) {
                                            e.preventDefault();
                                            setIsMobileMenuOpen(false);
                                            document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
                                            return;
                                        }
                                        handleNavigation(e, '#dashboard');
                                        if (!dashboardEdit?.editMode || !dashboardEdit?.hasUnsavedChanges) setIsMobileMenuOpen(false);
                                    }}
                                    className="flex flex-col items-center gap-1 transition-colors py-2 px-3 rounded-xl relative text-theme-tertiary active:text-theme-primary"
                                >
                                    {/* Animated sliding indicator - active state only */}
                                    {(() => {
                                        const isActive = !hash || hash === 'dashboard';

                                        return isActive && (
                                            <motion.div
                                                layoutId="mobileTabIndicator"
                                                className="absolute inset-0 rounded-xl bg-accent/20 shadow-lg"
                                                transition={sidebarSpring}
                                            />
                                        );
                                    })()}
                                    {/* Icon - with relative z-index to stay above indicator */}
                                    <div className={`relative z-10 ${(() => {
                                        const isActive = !hash || hash === 'dashboard';
                                        return isActive ? 'text-accent' : '';
                                    })()}`}>
                                        <LayoutDashboard size={24} />
                                    </div>
                                    <span className={`text-[10px] font-medium relative z-10 ${(() => {
                                        const isActive = !hash || hash === 'dashboard';
                                        return isActive ? 'text-accent' : '';
                                    })()}`}>Dashboard</span>
                                </a>
                                <a
                                    href="/#settings/profile"
                                    onClick={(e) => { triggerHaptic(); handleNavigation(e, '#settings/profile'); if (!dashboardEdit?.editMode || !dashboardEdit?.hasUnsavedChanges) setIsMobileMenuOpen(false); }}
                                    className="flex flex-col items-center gap-1 transition-colors py-2 px-3 rounded-xl relative text-theme-tertiary active:text-theme-primary"
                                >
                                    {/* Animated sliding indicator - active state only */}
                                    {(() => {
                                        const isActive = hash === 'settings/profile' || hash.startsWith('settings/profile?');

                                        return isActive && (
                                            <motion.div
                                                layoutId="mobileTabIndicator"
                                                className="absolute inset-0 rounded-xl bg-accent/20 shadow-lg"
                                                transition={sidebarSpring}
                                            />
                                        );
                                    })()}
                                    {/* Icon - with relative z-index to stay above indicator */}
                                    <div className={`relative z-10 ${(() => {
                                        const isActive = hash === 'settings/profile' || hash.startsWith('settings/profile?');
                                        return isActive ? 'text-accent' : '';
                                    })()}`}>
                                        {currentUser?.profilePicture ? (
                                            <img
                                                src={currentUser.profilePicture}
                                                alt="Profile"
                                                className="w-6 h-6 rounded-full object-cover border border-slate-600"
                                            />
                                        ) : (
                                            <UserCircle size={24} />
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-medium relative z-10 ${(() => {
                                        const isActive = hash === 'settings/profile' || hash.startsWith('settings/profile?');
                                        return isActive ? 'text-accent' : '';
                                    })()}`}>Profile</span>
                                </a>
                                <a
                                    href="/#settings"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        triggerHaptic();
                                        // Read current hash fresh (not stale render-time value)
                                        const currentHash = window.location.hash.slice(1);
                                        // If already on a settings page, go back to root settings menu
                                        const isOnSettings = currentHash.startsWith('settings');
                                        const dest = isOnSettings ? '#settings' : (lastSettingsPath || '#settings');

                                        // Check edit mode guard
                                        if (dashboardEdit?.editMode && dashboardEdit?.hasUnsavedChanges) {
                                            dashboardEdit.setPendingDestination(dest);
                                        } else {
                                            window.location.hash = dest;
                                        }
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className="flex flex-col items-center gap-1 transition-colors py-2 px-3 rounded-xl relative text-theme-tertiary active:text-theme-primary"
                                >
                                    {/* Animated sliding indicator - active state only */}
                                    {(() => {
                                        const isProfilePage = hash === 'settings/profile' || hash.startsWith('settings/profile?');
                                        const isActive = hash.startsWith('settings') && !isProfilePage;

                                        return isActive && (
                                            <motion.div
                                                layoutId="mobileTabIndicator"
                                                className="absolute inset-0 rounded-xl bg-accent/20 shadow-lg"
                                                transition={sidebarSpring}
                                            />
                                        );
                                    })()}
                                    {/* Icon - with relative z-index to stay above indicator */}
                                    <div className={`relative z-10 ${(() => {
                                        const isProfilePage = hash === 'settings/profile' || hash.startsWith('settings/profile?');
                                        const isActive = hash.startsWith('settings') && !isProfilePage;
                                        return isActive ? 'text-accent' : '';
                                    })()}`}>
                                        <SettingsIcon size={24} />
                                    </div>
                                    <span className={`text-[10px] font-medium relative z-10 ${(() => {
                                        const isProfilePage = hash === 'settings/profile' || hash.startsWith('settings/profile?');
                                        const isActive = hash.startsWith('settings') && !isProfilePage;
                                        return isActive ? 'text-accent' : '';
                                    })()}`}>Settings</span>
                                </a>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div >
        </>
    );
}

export default MobileTabBar;

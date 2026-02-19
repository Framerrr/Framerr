import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, LogOut, UserCircle, Mail, LayoutGrid, Settings as SettingsIcon, PanelLeftClose } from 'lucide-react';
import { useSharedSidebar } from './SharedSidebarContext';
import { Highlight, HighlightItem } from './Highlight';
import { sidebarSpring } from './types';
import NotificationCenter from '../notifications/NotificationCenter';
import { triggerHaptic } from '../../utils/haptics';
import { SidebarTabsContent } from './SidebarTabsContent';
import { SidebarSettingsContent } from './SidebarSettingsContent';


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
    const {
        isExpanded,
        setIsExpanded,
        isSidebarHidden,
        setSidebarHidden,
        currentUser,
        showNotificationCenter,
        setShowNotificationCenter,
        userSettings,
        unreadCount,
        dashboardEdit,
        hoverTimeoutRef,
        handleNavigation,
        handleLogout,
        renderIcon,
        getActiveNavItem,
        sidebarMode,
        setSidebarMode,
        shouldAutoExpand,
        lastSettingsPath,
    } = useSharedSidebar();

    // Peek state for edge-hover interaction when sidebar is hidden
    const [isPeeking, setIsPeeking] = useState(false);

    // Auto-collapse sidebar when entering edit mode
    useEffect(() => {
        if (dashboardEdit?.editMode && isExpanded) {
            setIsExpanded(false);
        }
    }, [dashboardEdit?.editMode]);

    // Parse current route for active state detection
    const hash = window.location.hash.slice(1);
    const hashParts = hash.split('?');
    const searchParams = hashParts.length > 1 ? new URLSearchParams(hashParts[1]) : new URLSearchParams();
    const currentTab = searchParams.get('tab');
    const source = searchParams.get('source');

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

    // Force sidebar visible when navigating to settings
    useEffect(() => {
        if (isOnSettingsPage && isSidebarHidden) {
            setIsExpanded(true);
        }
    }, [isOnSettingsPage, isSidebarHidden]);

    // Reset peek state when auto-hide is turned off
    useEffect(() => {
        if (!isSidebarHidden) {
            setIsPeeking(false);
        }
    }, [isSidebarHidden]);

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
                        setIsPeeking(true);
                    }}
                    onMouseLeave={() => {
                        setIsPeeking(false);
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
                        setIsPeeking(true);
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
                        // Mouse left the gap — start hide timer
                        hideTimeoutRef.current = setTimeout(() => {
                            setIsExpanded(false);
                            setIsPeeking(false);
                            hideTimeoutRef.current = null;
                        }, 300);
                    }}
                />
            )}

            {/* Backdrop when sidebar is expanded */}
            <AnimatePresence>
                {isExpanded && (
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
                className="flex flex-col relative fade-in"
                animate={{
                    width: showNotificationCenter ? 400 : (isExpanded ? 280 : 80),
                    left: sidebarLeft,
                    scale: sidebarScale,
                    opacity: sidebarOpacity,
                }}
                transition={sidebarSpring}
                style={{
                    height: 'calc(100vh - 32px)',
                    position: 'fixed',
                    top: '16px',
                    zIndex: 40,
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, var(--glass-start), var(--glass-end))',
                    backdropFilter: 'blur(var(--blur-strong))',
                    WebkitBackdropFilter: 'blur(var(--blur-strong))',
                    borderRadius: '20px',
                    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6), 0 12px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border-glass), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    transformOrigin: 'left center',
                    // Fix: force GPU to properly clip backdrop-filter to border-radius
                    WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                    maskImage: 'radial-gradient(white, black)',
                }}
                onMouseEnter={() => {
                    // Cancel any pending hide (prevents flicker)
                    if (hideTimeoutRef.current) {
                        clearTimeout(hideTimeoutRef.current);
                        hideTimeoutRef.current = null;
                    }

                    // Don't auto-expand sidebar during dashboard edit mode
                    if (dashboardEdit?.editMode) return;

                    // When peeking, don't auto-expand — user must click to expand
                    if (isPeeking) return;

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
                    if (isSidebarHidden && !isOnSettingsPage) {
                        // Debounce auto-hide to prevent flicker during animation
                        hideTimeoutRef.current = setTimeout(() => {
                            setIsExpanded(false);
                            setIsPeeking(false);
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
                    <div className="h-20 flex items-center border-b border-slate-700/30 text-accent font-semibold text-lg whitespace-nowrap overflow-hidden relative z-10">
                        {/* Icon - locked in 80px container */}
                        <div className="w-20 flex items-center justify-center flex-shrink-0 text-accent drop-shadow-lg">
                            {renderIcon(userSettings?.serverIcon, 28)}
                        </div>
                        {/* Text - appears when expanded */}
                        <AnimatePresence mode="wait">
                            {isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.1 }}
                                    className="gradient-text font-bold flex-1 min-w-0"
                                >
                                    {userSettings?.serverName || 'Dashboard'}
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
                                            setIsPeeking(false);
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
                    containerClassName="flex flex-col flex-1 min-h-0"
                    hover
                    exitDelay={100}
                    hoverLeaveDelay={500}
                    defaultValue={effectiveActiveNavItem}
                    transition={sidebarSpring}
                    mode="parent"
                    boundsOffset={{ left: 8, width: -16 }}
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
                        <nav ref={navScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1 relative" style={{ overscrollBehavior: 'contain' }}>
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

                            {/* Dashboard Link */}
                            <HighlightItem value="dashboard">
                                <a
                                    href="/#dashboard"
                                    onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                                        const isAlreadyOnDashboard = !window.location.hash || window.location.hash === '#dashboard';
                                        if (isAlreadyOnDashboard) {
                                            e.preventDefault();
                                            document.getElementById('dashboard-layer')?.scrollTo({ top: 0, behavior: 'smooth' });
                                            return;
                                        }
                                        handleNavigation(e, '#dashboard');
                                    }}
                                    className="relative flex items-center py-3.5 pl-20 min-h-[48px] text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors rounded-xl"
                                >
                                    {/* Icon - absolutely positioned in 80px left zone */}
                                    <div className="absolute left-0 w-20 h-full flex items-center justify-center">
                                        <span className={`flex items-center justify-center ${activeNavItem === 'dashboard' ? 'text-accent' : ''}`}>
                                            <LayoutDashboard size={20} />
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
                                                className={`whitespace-nowrap ${activeNavItem === 'dashboard' ? 'text-accent' : ''}`}
                                            >
                                                Dashboard
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </a>
                            </HighlightItem>

                            {/* Content Section - Conditionally render tabs or settings */}
                            {sidebarMode === 'tabs' && <SidebarTabsContent />}
                            {sidebarMode === 'settings' && <SidebarSettingsContent />}
                        </nav>
                    )}

                    {/* Footer - ALWAYS visible */}
                    <div className="flex-shrink-0 py-3 border-t border-slate-700/50 flex flex-col gap-2 relative">
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
                                        // Open notification center (overlay on current mode)
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

                        {/* Profile Link - navigates to settings/profile */}
                        <HighlightItem value="profile">
                            <a
                                href="/#settings/profile"
                                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavigation(e, '#settings/profile')}
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

                                    // Edit mode guard - same logic as handleNavigation
                                    if (dashboardEdit?.editMode) {
                                        if (dashboardEdit.hasUnsavedChanges) {
                                            // Block navigation as show warning popup
                                            dashboardEdit.setPendingDestination(destination);
                                            return;
                                        } else {
                                            // Exit edit mode first
                                            dashboardEdit.handlers?.handleCancel();
                                        }
                                    }

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
        </>
    );
}

export default DesktopSidebar;

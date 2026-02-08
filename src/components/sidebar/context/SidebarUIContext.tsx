import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { useLayout } from '../../../context/LayoutContext';
import { ExpandedGroups } from '../types';
import { useSidebarTabs } from './SidebarTabsContext';

// ============================================================================
// SidebarUIContext
// Manages: expansion state, mobile menu, group toggles, hover state, scroll lock
// ============================================================================

interface SidebarUIContextType {
    // Expansion state
    isExpanded: boolean;
    setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;

    // Mobile menu
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isMobile: boolean;

    // Group expansion
    expandedGroups: ExpandedGroups;
    setExpandedGroups: React.Dispatch<React.SetStateAction<ExpandedGroups>>;
    toggleGroup: (groupId: string) => void;

    // Hover state
    hoveredItem: string | null;
    setHoveredItem: React.Dispatch<React.SetStateAction<string | null>>;
    handleMouseEnter: (item: string) => void;
    handleMouseLeave: () => void;
    hoverTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;

    // Notification center toggle
    showNotificationCenter: boolean;
    setShowNotificationCenter: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarUIContext = createContext<SidebarUIContextType | null>(null);

interface SidebarUIProviderProps {
    children: ReactNode;
}

export function SidebarUIProvider({ children }: SidebarUIProviderProps) {
    // Get groups from SidebarTabsContext (per-user tab groups)
    const { groups } = useSidebarTabs();
    // Expansion state - initialize expanded if on settings page (prevents flash on refresh)
    const [isExpanded, setIsExpanded] = useState<boolean>(() => {
        const hash = window.location.hash.slice(1);
        return hash.startsWith('settings');
    });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

    // Group expansion - initialize from localStorage
    const [expandedGroups, setExpandedGroups] = useState<ExpandedGroups>(() => {
        try {
            const saved = localStorage.getItem('sidebar-expanded-groups');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    // Hover state
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Notification center
    const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);

    // Context hooks
    const { isMobile } = useLayout();

    // Toggle group expansion and persist to localStorage
    const toggleGroup = useCallback((groupId: string): void => {
        setExpandedGroups(prev => {
            const updated = {
                ...prev,
                [groupId]: !prev[groupId]
            };
            try {
                localStorage.setItem('sidebar-expanded-groups', JSON.stringify(updated));
            } catch {
                // Ignore localStorage errors
            }
            return updated;
        });
    }, []);

    // Default groups to open when they first load
    useEffect(() => {
        if (groups && groups.length > 0) {
            setExpandedGroups(prev => {
                let hasNewGroups = false;
                const updated = { ...prev };

                for (const group of groups) {
                    if (updated[group.id] === undefined) {
                        updated[group.id] = true; // Default to open
                        hasNewGroups = true;
                    }
                }

                if (hasNewGroups) {
                    try {
                        localStorage.setItem('sidebar-expanded-groups', JSON.stringify(updated));
                    } catch {
                        // Ignore localStorage errors
                    }
                    return updated;
                }
                return prev;
            });
        }
    }, [groups]);

    // Hover handlers
    const handleMouseEnter = useCallback((item: string): void => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setHoveredItem(item);
    }, []);

    const handleMouseLeave = useCallback((): void => {
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredItem(null);
            hoverTimeoutRef.current = null;
        }, 400);
    }, []);

    // Clean up hover timeout on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    // Clear hoveredItem when sidebar collapses
    useEffect(() => {
        if (!isExpanded) {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
            }
            setHoveredItem(null);
        }
    }, [isExpanded]);

    // iOS Safari scroll lock when mobile menu is open
    useEffect(() => {
        if (!isMobile || !isMobileMenuOpen) return undefined;

        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        const originalHtmlOverflow = document.documentElement.style.overflow;
        const originalHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
        const originalBodyOverflow = document.body.style.overflow;
        const originalBodyPosition = document.body.style.position;
        const originalBodyTop = document.body.style.top;
        const originalBodyLeft = document.body.style.left;
        const originalBodyRight = document.body.style.right;
        const originalBodyWidth = document.body.style.width;
        const originalTouchAction = document.body.style.touchAction;
        const originalBodyOverscrollBehavior = document.body.style.overscrollBehavior;

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.overscrollBehavior = 'none';
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        document.body.style.overscrollBehavior = 'none';

        let startY = 0;
        let startX = 0;
        let lockedDirection: 'horizontal' | 'vertical' | null = null;
        const LOCK_THRESHOLD = 10;

        const trackTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                startY = e.touches[0].clientY;
                startX = e.touches[0].clientX;
                lockedDirection = null;
            }
        };

        const preventTouchMove = (e: TouchEvent) => {
            const target = e.target as HTMLElement;

            const draggableElement = target.closest('[data-draggable="true"], [style*="touch-action: none"], [style*="touch-action:none"]');
            if (draggableElement) {
                e.preventDefault();
                return;
            }

            const deltaY = Math.abs(startY - e.touches[0].clientY);
            const deltaX = Math.abs(startX - e.touches[0].clientX);

            if (lockedDirection === null && (deltaX > LOCK_THRESHOLD || deltaY > LOCK_THRESHOLD)) {
                lockedDirection = deltaX > deltaY ? 'horizontal' : 'vertical';
            }

            if (lockedDirection === 'horizontal') {
                return;
            }

            if (lockedDirection === null && deltaX > deltaY) {
                return;
            }

            const scrollContainer = target.closest('.custom-scrollbar, .overflow-y-auto') as HTMLElement | null;

            if (scrollContainer) {
                const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
                const rawDeltaY = startY - e.touches[0].clientY;
                const isScrollingDown = rawDeltaY > 0;
                const isScrollingUp = rawDeltaY < 0;

                const isAtTop = scrollTop <= 0;
                const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

                if ((isAtTop && isScrollingUp) || (isAtBottom && isScrollingDown)) {
                    e.preventDefault();
                    return;
                }
                return;
            }
            e.preventDefault();
        };

        document.addEventListener('touchstart', trackTouchStart, { passive: true });
        document.addEventListener('touchmove', preventTouchMove, { passive: false });

        return () => {
            document.documentElement.style.overflow = originalHtmlOverflow;
            document.documentElement.style.overscrollBehavior = originalHtmlOverscrollBehavior;
            document.body.style.overflow = originalBodyOverflow;
            document.body.style.touchAction = originalTouchAction;
            document.body.style.overscrollBehavior = originalBodyOverscrollBehavior;

            document.removeEventListener('touchstart', trackTouchStart);
            document.removeEventListener('touchmove', preventTouchMove);
        };
    }, [isMobile, isMobileMenuOpen]);

    // Memoize context value
    const value = useMemo<SidebarUIContextType>(() => ({
        isExpanded,
        setIsExpanded,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        isMobile,
        expandedGroups,
        setExpandedGroups,
        toggleGroup,
        hoveredItem,
        setHoveredItem,
        handleMouseEnter,
        handleMouseLeave,
        hoverTimeoutRef,
        showNotificationCenter,
        setShowNotificationCenter,
    }), [
        isExpanded, isMobileMenuOpen, isMobile, expandedGroups, toggleGroup,
        hoveredItem, handleMouseEnter, handleMouseLeave, showNotificationCenter
    ]);

    return (
        <SidebarUIContext.Provider value={value}>
            {children}
        </SidebarUIContext.Provider>
    );
}

export function useSidebarUI() {
    const context = useContext(SidebarUIContext);
    if (!context) {
        throw new Error('useSidebarUI must be used within SidebarUIProvider');
    }
    return context;
}

export { SidebarUIContext };

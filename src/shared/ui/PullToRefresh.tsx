import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

const INDICATOR_SIZE = 36;     // px
const SAFE_AREA_TOP = 50;      // approx iOS safe area (notch/dynamic island)

/**
 * PullToRefresh — Mobile-only pull-to-refresh for the dashboard.
 *
 * Attaches touch event listeners directly to window.
 * When pulled down past threshold while at scrollTop=0, triggers a full page reload.
 * Shows a rotating refresh icon proportional to pull distance.
 *
 * Uses refs for all gesture tracking to avoid stale closures.
 * State is only used for triggering re-renders of the visual indicator.
 */
const PullToRefresh = (): React.JSX.Element | null => {
    // Render state — only for visual updates
    const [displayDistance, setDisplayDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Refs for gesture tracking (no stale closures)
    const startYRef = useRef(0);
    const trackingRef = useRef(false);
    const refreshingRef = useRef(false);
    const hapticFiredRef = useRef(false);
    const currentDistRef = useRef(0);

    // Only show on touch devices
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    useEffect(() => {
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, []);

    // Dynamic thresholds based on viewport
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const PULL_THRESHOLD = Math.round(vh * 0.15);   // ~15% viewport to commit
    const MAX_PULL = Math.round(vh * 0.45);          // max visual travel

    // Rubber-band: diminishing returns
    const rubberBand = useCallback((distance: number): number => {
        return MAX_PULL * (1 - 1 / (1 + distance / (MAX_PULL * 1.5)));
    }, [MAX_PULL]);

    useEffect(() => {
        if (!isTouchDevice) return;

        const isAtScrollTop = (): boolean => {
            // Dashboard scrolls inside #dashboard-layer, not window
            const layer = document.getElementById('dashboard-layer');
            if (layer) return layer.scrollTop <= 0;
            // Fallback to window scroll
            return window.scrollY <= 0 && document.documentElement.scrollTop <= 0;
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (refreshingRef.current) return;

            // Only activate when touch starts on the dashboard itself
            // Prevents triggering over mobile menu, notification center, modals, etc.
            const dashboardLayer = document.getElementById('dashboard-layer');
            if (!dashboardLayer || !dashboardLayer.contains(e.target as Node)) return;

            if (!isAtScrollTop()) return;

            startYRef.current = e.touches[0].clientY;
            trackingRef.current = true;
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!trackingRef.current || refreshingRef.current) return;

            const currentY = e.touches[0].clientY;
            const rawDelta = currentY - startYRef.current;

            // Only pull downward
            if (rawDelta <= 0) {
                if (currentDistRef.current > 0) {
                    currentDistRef.current = 0;
                    setDisplayDistance(0);
                    setIsDragging(false);
                    hapticFiredRef.current = false;
                }
                return;
            }

            // If we've scrolled away from top, stop tracking
            if (!isAtScrollTop() && currentDistRef.current === 0) {
                trackingRef.current = false;
                return;
            }

            // Prevent native scroll while pulling
            if (rawDelta > 10) {
                e.preventDefault();
            }

            const dist = rubberBand(rawDelta);
            currentDistRef.current = dist;
            setDisplayDistance(dist);
            setIsDragging(true);

            // Haptic when crossing threshold
            if (dist >= PULL_THRESHOLD && !hapticFiredRef.current) {
                triggerHaptic();
                hapticFiredRef.current = true;
            } else if (dist < PULL_THRESHOLD) {
                hapticFiredRef.current = false;
            }
        };

        const handleTouchEnd = () => {
            if (!trackingRef.current || refreshingRef.current) return;
            trackingRef.current = false;
            setIsDragging(false);
            hapticFiredRef.current = false;

            const dist = currentDistRef.current;

            if (dist >= PULL_THRESHOLD) {
                // Commit refresh
                refreshingRef.current = true;
                setIsRefreshing(true);
                setDisplayDistance(PULL_THRESHOLD);
                currentDistRef.current = PULL_THRESHOLD;
                triggerHaptic('medium');
                setTimeout(() => {
                    window.location.reload();
                }, 400);
            } else {
                currentDistRef.current = 0;
                setDisplayDistance(0);
            }
        };

        // passive: false on touchmove so we can preventDefault
        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });
        window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [isTouchDevice, rubberBand]);

    if (!isTouchDevice) return null;

    // Nothing to render when not active
    if (!isDragging && !isRefreshing && displayDistance === 0) return null;

    // Rotation: 0 to 360 degrees proportional to pull
    const rotation = isRefreshing ? 0 : (displayDistance / PULL_THRESHOLD) * 360;
    const opacity = Math.min(1, displayDistance / (PULL_THRESHOLD * 0.5));
    const pastThreshold = displayDistance >= PULL_THRESHOLD;
    const translateY = SAFE_AREA_TOP + Math.max(0, displayDistance - INDICATOR_SIZE);

    return (
        <>
            {/* Refresh indicator */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: '50%',
                    transform: `translateX(-50%) translateY(${translateY}px)`,
                    zIndex: 9999,
                    transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
                    opacity,
                    pointerEvents: 'none',
                }}
            >
                <div
                    style={{
                        width: INDICATOR_SIZE,
                        height: INDICATOR_SIZE,
                        borderRadius: '50%',
                        background: 'var(--bg-primary)',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.3), 0 0 0 1px var(--border-glass)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <RefreshCw
                        size={18}
                        style={{
                            color: pastThreshold ? 'var(--accent)' : 'var(--text-secondary)',
                            transform: `rotate(${rotation}deg)`,
                            transition: isDragging ? 'none' : 'transform 0.3s ease',
                            animation: isRefreshing ? 'ptr-spin 0.6s linear infinite' : 'none',
                        }}
                    />
                </div>
            </div>

            {/* Keyframes for spinning */}
            <style>{`
                @keyframes ptr-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
};

export default PullToRefresh;

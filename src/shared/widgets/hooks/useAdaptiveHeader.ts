/**
 * useAdaptiveHeader Hook
 * 
 * Central hook for header visibility calculation with live resize support.
 * Uses ResizeObserver to track container height in real-time and calculates
 * effective header visibility based on the plugin's headerHeightMode.
 * 
 * Modes:
 * - 'soft' (DEFAULT): Header shows if user preference ON and h >= minHeightForHeader
 * - 'hard': Header visibility strictly determined by height
 */

import { useState, useLayoutEffect, useMemo, RefObject, useCallback } from 'react';
import { getWidgetConfigConstraints } from '../../../widgets/registry';
import { ROW_HEIGHT } from '../../../constants/gridConfig';

interface UseAdaptiveHeaderProps {
    /** Widget type for plugin lookup */
    widgetType: string;
    /** User's header preference from widget.config.showHeader */
    showHeaderPreference: boolean;
    /** Ref to the widget container element for ResizeObserver */
    containerRef: RefObject<HTMLElement | null>;
}

interface UseAdaptiveHeaderReturn {
    /** Whether header should currently be visible (based on live height) */
    effectiveShowHeader: boolean;
    /** Current container height in pixels */
    containerHeight: number;
    /** The mode being used ('soft' or 'hard') */
    headerHeightMode: 'soft' | 'hard';
    /** Minimum rows required for header */
    minHeightForHeader: number;
    /** Whether toggle should trigger resize (hard mode only) */
    toggleTriggersResize: boolean;
}

export function useAdaptiveHeader({
    widgetType,
    showHeaderPreference,
    containerRef,
}: UseAdaptiveHeaderProps): UseAdaptiveHeaderReturn {
    const [containerHeight, setContainerHeight] = useState(0);
    const [, forceUpdate] = useState(0);

    // Get plugin constraints
    const constraints = useMemo(() =>
        getWidgetConfigConstraints(widgetType),
        [widgetType]
    );

    // Apply defaults - SOFT is the global default
    const headerHeightMode = constraints.headerHeightMode ?? 'soft';
    const minHeightForHeader = constraints.minHeightForHeader ?? 2;

    // Force a re-render after mount to ensure ref is attached
    useLayoutEffect(() => {
        forceUpdate(n => n + 1);
    }, []);

    // Track container height with ResizeObserver - using useLayoutEffect for sync DOM access
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        // Initial measurement
        const initialHeight = el.getBoundingClientRect().height;
        setContainerHeight(initialHeight);

        const observer = new ResizeObserver((entries) => {
            const height = entries[0]?.contentRect.height ?? 0;
            setContainerHeight(height);
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, [containerRef]);

    // Calculate effective header visibility
    const effectiveShowHeader = useMemo(() => {
        // Bypass if widget doesn't support headers
        if (constraints.supportsHeader === false) {
            return false;
        }

        // Calculate height threshold in pixels
        // h:2 with ROW_HEIGHT=60 = 120px, but with margins actual container might be ~130px
        // Use a lower threshold to ensure header shows when expected
        const heightThreshold = (minHeightForHeader * ROW_HEIGHT) - 20;
        const hasEnoughHeight = containerHeight >= heightThreshold;

        if (headerHeightMode === 'hard') {
            // Hard mode: purely height-driven, ignore user preference
            return hasEnoughHeight;
        }

        // Soft mode (default): user preference + height guard
        return showHeaderPreference && hasEnoughHeight;
    }, [headerHeightMode, containerHeight, minHeightForHeader, showHeaderPreference, constraints.supportsHeader]);

    return {
        effectiveShowHeader,
        containerHeight,
        headerHeightMode,
        minHeightForHeader,
        toggleTriggersResize: headerHeightMode === 'hard',
    };
}

export default useAdaptiveHeader;

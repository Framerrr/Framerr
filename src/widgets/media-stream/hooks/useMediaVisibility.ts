/**
 * useMediaVisibility Hook
 *
 * Manages the hideWhenEmpty visibility logic for the Media Stream widget.
 * Notifies the dashboard/grid when visibility changes.
 *
 * The hideWhenEmpty setting is configured via WidgetConfigModal (plugin-driven).
 * This hook reads the config value and reports visibility to the grid core.
 */

import { useEffect, useRef } from 'react';
import type { MediaSession } from '../adapters';

interface UseMediaVisibilityProps {
    sessions: MediaSession[];
    hideWhenEmpty: boolean;
    editMode: boolean;
    widgetId: string | undefined;
    isIntegrationBound: boolean;
    /** Whether data is still loading - don't hide while loading */
    isLoading: boolean;
    onVisibilityChange?: (widgetId: string, isVisible: boolean) => void;
}

interface UseMediaVisibilityReturn {
    /** Whether the widget should hide completely (return null from render) */
    shouldHide: boolean;
}

export const useMediaVisibility = ({
    sessions,
    hideWhenEmpty,
    editMode,
    widgetId,
    isIntegrationBound,
    isLoading,
    onVisibilityChange,
}: UseMediaVisibilityProps): UseMediaVisibilityReturn => {
    const previousVisibilityRef = useRef<boolean | null>(null);

    // Calculate visibility based on config and current state
    // IMPORTANT: Don't hide while loading - wait until we know for sure there are no sessions
    const hasSessions = sessions.length > 0;
    const shouldBeVisible = hasSessions || editMode || isLoading;
    const isVisible = !hideWhenEmpty || shouldBeVisible;

    // Notify dashboard/grid when visibility changes
    useEffect(() => {
        if (!onVisibilityChange || !isIntegrationBound || !widgetId) return;

        // Only call onVisibilityChange if visibility actually changed
        if (previousVisibilityRef.current !== isVisible) {
            previousVisibilityRef.current = isVisible;
            onVisibilityChange(widgetId, isVisible);
        }
    }, [isVisible, widgetId, onVisibilityChange, isIntegrationBound]);

    return {
        // Don't hide while loading - only hide when we know for sure there are no sessions
        shouldHide: hideWhenEmpty && !hasSessions && !editMode && !isLoading,
    };
};

export default useMediaVisibility;

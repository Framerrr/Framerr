import { useEffect, useRef, useState } from 'react';
import { configApi } from '../../../api/endpoints';
import { signalAppReady, setSplashMessage } from '../../../utils/splash';
import logger from '../../../utils/logger';
import type { FramerrWidget } from '../../../../shared/types/widget';
import type { LayoutItem } from '../../../shared/grid/core/types';

/**
 * useDashboardEffects - Consolidated standalone effects for the Dashboard.
 * 
 * Extracted from Dashboard.tsx to isolate effect logic from rendering.
 * Contains: square cells preference, iOS workarounds, visibility tracking,
 * debug pixel sizes, event listeners, and splash screen integration.
 */

interface UseDashboardEffectsParams {
    editMode: boolean;
    isMobile: boolean;
    widgets: FramerrWidget[];
    mobileWidgets: FramerrWidget[];
    layouts: { sm: LayoutItem[]; lg: LayoutItem[] };
    mobileLayoutMode: 'linked' | 'independent';
    pendingUnlink: boolean;
    widgetVisibility: Record<string, boolean>;
    debugOverlayEnabled: boolean;
    loading: boolean;
    loadingMsg: { text: string } | null;
    setWidgetPixelSizes: (sizes: Record<string, { w: number; h: number }>) => void;
    fetchWidgets: () => void;
}

interface UseDashboardEffectsResult {
    squareCells: boolean;
}

export function useDashboardEffects(params: UseDashboardEffectsParams): UseDashboardEffectsResult {
    const {
        editMode,
        isMobile,
        widgets,
        mobileWidgets,
        layouts,
        mobileLayoutMode,
        pendingUnlink,
        widgetVisibility,
        debugOverlayEnabled,
        loading,
        loadingMsg,
        setWidgetPixelSizes,
        fetchWidgets,
    } = params;

    // ========== SQUARE CELLS (EXPERIMENTAL) ==========
    const [squareCells, setSquareCells] = useState(false);
    useEffect(() => {
        const loadPref = async () => {
            try {
                const response = await configApi.getUser();
                if (response?.preferences?.squareCells) setSquareCells(true);
            } catch { /* ignore */ }
        };
        loadPref();
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.squareCells !== undefined) setSquareCells(!!detail.squareCells);
        };
        window.addEventListener('user-preferences-changed', handler);
        return () => window.removeEventListener('user-preferences-changed', handler);
    }, []);

    // ========== iOS PWA WORKAROUND ==========
    // Set inline styles for resize handles on mobile
    useEffect(() => {
        if (!editMode || !isMobile) return;

        const handles = document.querySelectorAll('.react-resizable-handle');
        handles.forEach((handle) => {
            const el = handle as HTMLElement;
            el.style.pointerEvents = 'auto';
            el.style.touchAction = 'none';
        });

        return () => {
            handles.forEach((handle) => {
                const el = handle as HTMLElement;
                el.style.pointerEvents = '';
                el.style.touchAction = '';
            });
        };
    }, [editMode, isMobile, widgets]);

    // ========== VISIBILITY HEIGHT ADJUSTMENT ==========
    const prevVisibilityRef = useRef<Record<string, boolean>>({});
    const prevEditModeRef = useRef<boolean>(false);
    useEffect(() => {
        if (!widgets.length) return;

        const editModeJustEnabled = editMode && !prevEditModeRef.current;
        prevEditModeRef.current = editMode;

        if (editModeJustEnabled || editMode) return;

        const visibilityChanged = Object.keys(widgetVisibility).some(
            key => widgetVisibility[key] !== prevVisibilityRef.current[key]
        ) || Object.keys(prevVisibilityRef.current).some(
            key => prevVisibilityRef.current[key] !== widgetVisibility[key]
        );

        prevVisibilityRef.current = { ...widgetVisibility };

        if (!visibilityChanged) return;
    }, [widgetVisibility, widgets, mobileWidgets, mobileLayoutMode, pendingUnlink, editMode]);

    // ========== DEBUG PIXEL SIZE TRACKING ==========
    useEffect(() => {
        if (!debugOverlayEnabled) return;

        const updateSizes = () => {
            const widgetElements = document.querySelectorAll('[data-widget-id]');
            const sizes: Record<string, { w: number; h: number }> = {};
            widgetElements.forEach((el) => {
                const widgetId = el.getAttribute('data-widget-id');
                if (widgetId) {
                    const rect = el.getBoundingClientRect();
                    const computed = window.getComputedStyle(el);
                    const paddingLeft = parseFloat(computed.paddingLeft) || 0;
                    const paddingRight = parseFloat(computed.paddingRight) || 0;
                    const paddingTop = parseFloat(computed.paddingTop) || 0;
                    const paddingBottom = parseFloat(computed.paddingBottom) || 0;
                    sizes[widgetId] = {
                        w: Math.round(rect.width - paddingLeft - paddingRight),
                        h: Math.round(rect.height - paddingTop - paddingBottom)
                    };
                }
            });
            setWidgetPixelSizes(sizes);
        };

        updateSizes();

        const observer = new ResizeObserver(() => updateSizes());
        const widgetElements = document.querySelectorAll('[data-widget-id]');
        widgetElements.forEach((el) => observer.observe(el));
        window.addEventListener('resize', updateSizes);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateSizes);
        };
    }, [debugOverlayEnabled, widgets, mobileWidgets, layouts, setWidgetPixelSizes]);

    // ========== EVENT LISTENERS ==========
    useEffect(() => {
        const handleWidgetsAdded = (): void => {
            logger.debug('widgets-added event received, reloading dashboard');
            fetchWidgets();
        };

        // Also listen for widget-config-updated (dispatched by fallback persistence)
        const handleConfigUpdated = (): void => {
            logger.debug('widget-config-updated event received, reloading dashboard');
            fetchWidgets();
        };

        window.addEventListener('widgets-added', handleWidgetsAdded);
        window.addEventListener('widget-config-updated', handleConfigUpdated);
        return () => {
            window.removeEventListener('widgets-added', handleWidgetsAdded);
            window.removeEventListener('widget-config-updated', handleConfigUpdated);
        };
    }, [fetchWidgets]);

    // ========== SPLASH SCREEN INTEGRATION ==========

    // Update splash message while loading
    useEffect(() => {
        if (loading && loadingMsg) {
            setSplashMessage(loadingMsg.text);
        }
    }, [loading, loadingMsg]);

    // Signal app ready when data loads — triggers theme airlock + splash dismiss
    useEffect(() => {
        if (!loading) {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark-pro';
            signalAppReady(currentTheme);
        }
    }, [loading]);

    return { squareCells };
}

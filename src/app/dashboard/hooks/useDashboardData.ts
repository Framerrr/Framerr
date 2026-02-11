// Dashboard data hook - handles fetching and state management
// Extracted from Dashboard.tsx during Phase 6.2 refactor
// P2 React Query Migration: Uses centralized hooks for server state

import { useState, useEffect, useCallback, useMemo } from 'react';
import logger from '../../../utils/logger';
import { generateAllMobileLayouts } from '../../../utils/layoutUtils';
import { isAdmin } from '../../../utils/permissions';
import { getWidgetMetadata } from '../../../widgets/registry';
import {
    useWidgets,
    useRoleAwareIntegrations,
    useWidgetAccess,
    useUserPreferences,
    useDebugOverlay
} from '../../../api/hooks';
import type { FramerrWidget } from '../../../../shared/types/widget';
import type { User } from '../../../../shared/types/user';
import type {
    IntegrationConfig,
    SharedIntegration,
} from '../types';

interface UseDashboardDataOptions {
    user: User | null;
    setInitialData: (data: {
        widgets: FramerrWidget[];
        mobileWidgets?: FramerrWidget[];
        mobileLayoutMode: 'linked' | 'independent';
    }) => void;
}

interface UseDashboardDataReturn {
    // Loading states
    loading: boolean;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    saving: boolean;
    setSaving: React.Dispatch<React.SetStateAction<boolean>>;

    // Global drag state
    isGlobalDragEnabled: boolean;
    setGlobalDragEnabled: React.Dispatch<React.SetStateAction<boolean>>;

    // Input type
    isUsingTouch: boolean;
    setIsUsingTouch: React.Dispatch<React.SetStateAction<boolean>>;

    // Integrations
    integrations: Record<string, IntegrationConfig>;
    sharedIntegrations: SharedIntegration[];

    // Widget visibility
    widgetVisibility: Record<string, boolean>;
    handleWidgetVisibilityChange: (widgetId: string, isVisible: boolean) => void;

    // Greeting
    greetingMode: 'auto' | 'manual';
    setGreetingMode: React.Dispatch<React.SetStateAction<'auto' | 'manual'>>;
    greetingText: string;
    setGreetingText: React.Dispatch<React.SetStateAction<string>>;
    headerVisible: boolean;
    setHeaderVisible: React.Dispatch<React.SetStateAction<boolean>>;
    taglineEnabled: boolean;
    setTaglineEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    taglineText: string;
    setTaglineText: React.Dispatch<React.SetStateAction<string>>;
    tones: string[];
    setTones: React.Dispatch<React.SetStateAction<string[]>>;
    loadingMessagesEnabled: boolean;
    setLoadingMessagesEnabled: React.Dispatch<React.SetStateAction<boolean>>;

    // User preferences
    mobileDisclaimerDismissed: boolean;
    setMobileDisclaimerDismissed: React.Dispatch<React.SetStateAction<boolean>>;
    hideMobileEditButton: boolean;
    setHideMobileEditButton: React.Dispatch<React.SetStateAction<boolean>>;

    // Debug
    debugOverlayEnabled: boolean;
    widgetPixelSizes: Record<string, { w: number; h: number }>;
    setWidgetPixelSizes: React.Dispatch<React.SetStateAction<Record<string, { w: number; h: number }>>>;

    // Admin check
    userIsAdmin: boolean;

    // Widget type access (for non-admin users)
    accessibleWidgetTypes: string[] | 'all';
    hasWidgetAccess: (widgetType: string) => boolean;

    // Refetch function
    fetchWidgets: () => Promise<void>;
    fetchIntegrations: () => Promise<void>;
}

export function useDashboardData({
    user,
    setInitialData
}: UseDashboardDataOptions): UseDashboardDataReturn {
    // User permissions
    const userIsAdmin = isAdmin(user);

    // =========================================================================
    // P2 React Query: Server State
    // =========================================================================

    // Widgets data
    const { data: rawWidgetData, isLoading: loadingWidgets, refetch: refetchWidgets } = useWidgets();

    // Integration data - role-aware hook handles admin/non-admin
    const { data: allIntegrations = [], isLoading: loadingIntegrations } = useRoleAwareIntegrations();

    // Widget access for non-admin users
    const { data: widgetAccessData } = useWidgetAccess();

    // User preferences
    const { data: userPreferencesData } = useUserPreferences();

    // Debug overlay (admin only - skip query for non-admin)
    const { data: debugOverlayEnabled = false } = useDebugOverlay({ enabled: userIsAdmin });

    // =========================================================================
    // Derived State from React Query
    // =========================================================================

    // Transform widget data (migration + layout generation)
    // Transform API response to FramerrWidget format
    // API now returns widgets with layout/mobileLayout directly (FramerrWidget format)
    const transformedWidgetData = useMemo(() => {
        if (!rawWidgetData) {
            return { widgets: [] as FramerrWidget[], mobileWidgets: [] as FramerrWidget[], mobileLayoutMode: 'linked' as const };
        }

        // API returns widgets in FramerrWidget format with layout/mobileLayout
        // Cast from API Widget type (which has same structure)
        let fetchedWidgets = (rawWidgetData.widgets || []) as unknown as FramerrWidget[];
        const fetchedMobileMode = rawWidgetData.mobileLayoutMode || 'linked';
        let fetchedMobileWidgets: FramerrWidget[] = [];

        // Generate mobile layouts if linked mode or no mobile widgets provided
        if (fetchedMobileMode === 'independent' && (rawWidgetData.mobileWidgets || []).length > 0) {
            fetchedMobileWidgets = (rawWidgetData.mobileWidgets || []) as unknown as FramerrWidget[];
            // Generate mobile layouts for desktop widgets in independent mode
            fetchedWidgets = generateAllMobileLayouts(fetchedWidgets);
        } else {
            // Generate mobile layouts for linked mode
            fetchedWidgets = generateAllMobileLayouts(fetchedWidgets);
        }

        return {
            widgets: fetchedWidgets,
            mobileWidgets: fetchedMobileWidgets,
            mobileLayoutMode: fetchedMobileMode
        };
    }, [rawWidgetData]);

    // Derive integrations from query data
    const integrations = useMemo(() => {
        const integrationsByType: Record<string, IntegrationConfig> = {};
        for (const instance of allIntegrations) {
            if (!integrationsByType[instance.type]) {
                integrationsByType[instance.type] = {
                    enabled: instance.enabled,
                    isConfigured: instance.enabled !== false,
                    url: instance.config?.url,
                    apiKey: instance.config?.apiKey
                };
            } else if (instance.enabled !== false) {
                integrationsByType[instance.type].isConfigured = true;
            }
        }
        return integrationsByType;
    }, [allIntegrations]);

    // Shared integrations for non-admin (same as allIntegrations from role-aware hook)
    const sharedIntegrations: SharedIntegration[] = useMemo(() => {
        if (userIsAdmin) return [];
        return (allIntegrations as unknown as SharedIntegration[]) || [];
    }, [userIsAdmin, allIntegrations]);

    // Derive accessible widget types
    const accessibleWidgetTypes = useMemo((): string[] | 'all' => {
        if (userIsAdmin) return 'all';
        if (widgetAccessData?.widgets === 'all') return 'all';
        return widgetAccessData?.widgets || [];
    }, [userIsAdmin, widgetAccessData]);

    // Loading state - derived from all queries
    const queryLoading = loadingWidgets || loadingIntegrations;

    // =========================================================================
    // Local UI State (not server state)
    // =========================================================================

    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [isGlobalDragEnabled, setGlobalDragEnabled] = useState<boolean>(true);
    const [isUsingTouch, setIsUsingTouch] = useState<boolean>(true);
    const [widgetVisibility, setWidgetVisibility] = useState<Record<string, boolean>>({});
    const [widgetPixelSizes, setWidgetPixelSizes] = useState<Record<string, { w: number; h: number }>>({});

    // Greeting & header preferences - initialized from query data
    const [greetingMode, setGreetingMode] = useState<'auto' | 'manual'>('auto');
    const [greetingText, setGreetingText] = useState<string>('');
    const [headerVisible, setHeaderVisible] = useState<boolean>(true);
    const [taglineEnabled, setTaglineEnabled] = useState<boolean>(true);
    const [taglineText, setTaglineText] = useState<string>('Your personal dashboard');
    const [tones, setTones] = useState<string[]>(['standard', 'witty', 'nerdy']);
    const [loadingMessagesEnabled, setLoadingMessagesEnabled] = useState<boolean>(() => {
        const saved = localStorage.getItem('framerr-loading-messages');
        return saved !== null ? saved !== 'false' : true;
    });
    const [mobileDisclaimerDismissed, setMobileDisclaimerDismissed] = useState<boolean>(false);
    const [hideMobileEditButton, setHideMobileEditButton] = useState<boolean>(false);

    // =========================================================================
    // Effects
    // =========================================================================

    // Sync loading state with query loading
    useEffect(() => {
        setLoading(queryLoading);
    }, [queryLoading]);

    // Pass transformed widget data to parent via setInitialData
    useEffect(() => {
        if (rawWidgetData) {
            setInitialData(transformedWidgetData);
            logger.debug('Loaded widgets from API (React Query)');
        }
    }, [rawWidgetData, transformedWidgetData, setInitialData]);

    // Initialize preferences from query data
    useEffect(() => {
        if (userPreferencesData) {
            const prefs = userPreferencesData.preferences;
            if (prefs?.mobileEditDisclaimerDismissed) {
                setMobileDisclaimerDismissed(true);
            }
            if (prefs?.hideMobileEditButton) {
                setHideMobileEditButton(true);
            }
            if (prefs?.dashboardGreeting) {
                const g = prefs.dashboardGreeting;
                setGreetingMode(g.mode || 'auto');
                const displayName = user?.displayName || user?.username || 'User';
                setGreetingText((g.text || 'Welcome back, {user}').replace(/\{user\}/gi, displayName));
                setHeaderVisible(g.headerVisible ?? true);
                setTaglineEnabled(g.taglineEnabled ?? g.enabled ?? true);
                setTaglineText(g.taglineText || g.text || 'Your personal dashboard');
                setTones(g.tones || ['standard', 'witty', 'nerdy']);
                setLoadingMessagesEnabled(g.loadingMessages ?? true);
                // Persist to localStorage for instant splash screen preference on next load
                localStorage.setItem('framerr-loading-messages', String(g.loadingMessages ?? true));
            }
        }
    }, [userPreferencesData]);

    // Listen for preference changes from settings page
    useEffect(() => {
        const handlePreferencesChanged = (event: CustomEvent<{ hideMobileEditButton?: boolean }>) => {
            if (event.detail.hideMobileEditButton !== undefined) {
                setHideMobileEditButton(event.detail.hideMobileEditButton);
            }
        };

        window.addEventListener('user-preferences-changed', handlePreferencesChanged as EventListener);
        return () => {
            window.removeEventListener('user-preferences-changed', handlePreferencesChanged as EventListener);
        };
    }, []);

    // Detect input type (touch vs mouse) to conditionally enable hold-to-drag
    useEffect(() => {
        const handleTouchStart = () => setIsUsingTouch(true);
        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0) {
                setIsUsingTouch(false);
            }
        };

        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('mousedown', handleMouseDown, { passive: true });

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('mousedown', handleMouseDown);
        };
    }, []);

    // =========================================================================
    // Callbacks
    // =========================================================================

    const handleWidgetVisibilityChange = useCallback((widgetId: string, isVisible: boolean): void => {
        setWidgetVisibility(prev => ({
            ...prev,
            [widgetId]: isVisible
        }));
    }, []);

    // Check if user has access to a widget type
    const hasWidgetAccess = useCallback((widgetType: string): boolean => {
        if (userIsAdmin) return true;
        // Global/utility widgets (clock, weather, link-grid, custom-html) are always accessible
        const metadata = getWidgetMetadata(widgetType);
        if (metadata?.isGlobal) return true;
        if (accessibleWidgetTypes === 'all') return true;
        return accessibleWidgetTypes.includes(widgetType);
    }, [userIsAdmin, accessibleWidgetTypes]);

    // Refetch functions for manual refresh
    const fetchWidgets = useCallback(async (): Promise<void> => {
        await refetchWidgets();
    }, [refetchWidgets]);

    // Integrations refetch is handled by React Query cache invalidation
    const fetchIntegrations = useCallback(async (): Promise<void> => {
        // React Query handles refetching automatically via cache invalidation
        // This is kept for API compatibility with existing consumers
        logger.debug('fetchIntegrations called - React Query handles refetching');
    }, []);

    return {
        loading,
        setLoading,
        saving,
        setSaving,
        isGlobalDragEnabled,
        setGlobalDragEnabled,
        isUsingTouch,
        setIsUsingTouch,
        integrations,
        sharedIntegrations,
        widgetVisibility,
        handleWidgetVisibilityChange,
        greetingMode,
        setGreetingMode,
        greetingText,
        setGreetingText,
        headerVisible,
        setHeaderVisible,
        taglineEnabled,
        setTaglineEnabled,
        taglineText,
        setTaglineText,
        tones,
        setTones,
        loadingMessagesEnabled,
        setLoadingMessagesEnabled,
        mobileDisclaimerDismissed,
        setMobileDisclaimerDismissed,
        hideMobileEditButton,
        setHideMobileEditButton,
        debugOverlayEnabled,
        widgetPixelSizes,
        setWidgetPixelSizes,
        userIsAdmin,
        accessibleWidgetTypes,
        hasWidgetAccess,
        fetchWidgets,
        fetchIntegrations,
    };
}

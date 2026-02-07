/**
 * useWidgetData Hook
 * 
 * Shared data fetching logic for widget visibility and integration status.
 * Used by both AddWidgetModal and GallerySection to avoid duplication.
 * 
 * P2 Migration: Conditional Query Orchestration pattern
 * - Server state: Uses existing React Query hooks conditionally based on admin status
 * - Derived state: isWidgetVisible, getSharedByInfo computed from RQ data
 * 
 * Phase 24: SSE Permission Subscription
 * - Listens for permissions:widgets events and invalidates React Query cache
 * - All consumers auto-update when widget/integration permissions change
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { isAdmin } from '../../../utils/permissions';
import { useRoleAwareIntegrations } from '../../../api/hooks/useIntegrations';
import { useMyWidgetAccess } from '../../../api/hooks/useWidgetQueries';
import useRealtimeSSE from '../../../hooks/useRealtimeSSE';
import { queryKeys } from '../../../api/queryKeys';
import logger from '../../../utils/logger';
import type { IntegrationConfig, SharedIntegration } from '../../../settings/widgets/types';
import type { WidgetMetadata } from '../../../widgets/registry';

export interface UseWidgetDataOptions {
    /** Whether to fetch immediately on mount (now ignored - RQ handles this) */
    fetchOnMount?: boolean;
}

export interface UseWidgetDataResult {
    /** Loading state */
    loading: boolean;
    /** Whether user has admin access */
    hasAdminAccess: boolean;
    /** Integration configurations (admin only) */
    integrations: Record<string, IntegrationConfig>;
    /** Shared integrations (non-admin) */
    sharedIntegrations: SharedIntegration[];
    /** Accessible widget types ('all' for admin, array for non-admin) */
    accessibleWidgets: string[] | 'all';
    /** Accessible integration types ('all' for admin, array for non-admin) */
    accessibleIntegrationTypes: string[] | 'all';
    /** Fetch/refresh integration data */
    fetchIntegrations: () => Promise<void>;
    /** Check if a widget is visible to current user */
    isWidgetVisible: (widget: WidgetMetadata) => boolean;
    /** Get share info for a widget (for badge display) */
    getSharedByInfo: (widget: WidgetMetadata) => string | null;
}

export function useWidgetData(_options: UseWidgetDataOptions = {}): UseWidgetDataResult {
    const { user } = useAuth();
    const hasAdminAccess = isAdmin(user);

    // ========================================================================
    // Server State (React Query - conditional based on admin status)
    // ========================================================================

    // Role-aware integrations: calls /shared for non-admin, /api/integrations for admin
    const {
        data: allIntegrations = [],
        isLoading: integrationsLoading,
        refetch: refetchIntegrations,
    } = useRoleAwareIntegrations();

    // Non-admin: fetch widget access
    const {
        data: accessData,
        isLoading: accessLoading,
    } = useMyWidgetAccess();

    // ========================================================================
    // Global Settings SSE: Invalidate queries when settings change
    // ========================================================================

    const queryClient = useQueryClient();
    const { onSettingsInvalidate } = useRealtimeSSE();

    useEffect(() => {
        const unsubscribe = onSettingsInvalidate((event) => {
            // Only handle permissions entity
            if (event.entity === 'permissions') {
                logger.info('[useWidgetData] Permissions changed, invalidating widget access and shared integrations');
                queryClient.invalidateQueries({ queryKey: queryKeys.widgets.access() });
                queryClient.invalidateQueries({ queryKey: queryKeys.integrations.shared() });
            }
        });

        return unsubscribe;
    }, [onSettingsInvalidate, queryClient]);

    // ========================================================================
    // Derived State
    // ========================================================================

    // Loading state - unified since useRoleAwareIntegrations handles both cases
    const loading = integrationsLoading || accessLoading;

    // Convert integrations array to object keyed by type (for admin compatibility)
    const integrations = useMemo<Record<string, IntegrationConfig>>(() => {
        if (!hasAdminAccess) return {};

        const instanceList = Array.isArray(allIntegrations) ? allIntegrations : [];
        const integrationsByType: Record<string, IntegrationConfig> = {};

        for (const instance of instanceList) {
            if (!integrationsByType[instance.type]) {
                integrationsByType[instance.type] = {
                    enabled: instance.enabled,
                    isConfigured: instance.enabled,
                    url: instance.config?.url
                };
            } else if (instance.enabled) {
                integrationsByType[instance.type].isConfigured = true;
            }
        }
        return integrationsByType;
    }, [hasAdminAccess, allIntegrations]);

    // Shared integrations: for non-admins, allIntegrations is already the shared list
    const sharedIntegrations = useMemo<SharedIntegration[]>(() => {
        if (hasAdminAccess) return [];
        // allIntegrations from useRoleAwareIntegrations is the shared list for non-admins
        return (allIntegrations as unknown as SharedIntegration[]) || [];
    }, [hasAdminAccess, allIntegrations]);

    // Accessible widgets (admin = 'all', non-admin = from access data)
    const accessibleWidgets = useMemo<string[] | 'all'>(() => {
        if (hasAdminAccess) return 'all';
        const widgets = accessData?.widgets;
        return widgets === 'all' ? 'all' : (widgets || []);
    }, [hasAdminAccess, accessData]);

    // Accessible integration types (admin = 'all', non-admin = from access data)
    const accessibleIntegrationTypes = useMemo<string[] | 'all'>(() => {
        if (hasAdminAccess) return 'all';
        const types = accessData?.integrationTypes;
        return types === 'all' ? 'all' : (types || []);
    }, [hasAdminAccess, accessData]);

    // ========================================================================
    // Helpers
    // ========================================================================

    /**
     * Check if a widget is visible to the current user
     * 
     * NOTE: This only checks widget-type access, NOT integration access.
     * A widget should be visible in the gallery even if no integrations are shared.
     * The widget will show a 'disabled' or 'notConfigured' message when rendered.
     */
    const isWidgetVisible = useCallback((widget: WidgetMetadata): boolean => {
        // Admins see all
        if (hasAdminAccess) return true;

        // Utility widgets (no integration required) - always visible
        if (!widget.compatibleIntegrations || widget.compatibleIntegrations.length === 0) {
            return true;
        }

        // Check widget-type access only (NOT integration access)
        // The widget's render will handle showing 'disabled' if no integrations available
        if (accessibleWidgets !== 'all' && widget.type) {
            if (!accessibleWidgets.includes(widget.type)) {
                return false;
            }
        }

        return true;
    }, [hasAdminAccess, accessibleWidgets]);

    /**
     * Get share info for a widget (for badge display)
     */
    const getSharedByInfo = useCallback((widget: WidgetMetadata): string | null => {
        if (widget.compatibleIntegrations && widget.compatibleIntegrations.length > 0) {
            const shared = sharedIntegrations.find(si =>
                widget.compatibleIntegrations?.includes(si.name)
            );
            return shared?.sharedBy || null;
        }
        return null;
    }, [sharedIntegrations]);

    /**
     * Refetch integration data (wraps RQ refetch for API compatibility)
     */
    const fetchIntegrations = useCallback(async () => {
        await refetchIntegrations();
    }, [refetchIntegrations]);

    // ========================================================================
    // Return
    // ========================================================================

    return {
        loading,
        hasAdminAccess,
        integrations,
        sharedIntegrations,
        accessibleWidgets,
        accessibleIntegrationTypes,
        fetchIntegrations,
        isWidgetVisible,
        getSharedByInfo,
    };
}

export default useWidgetData;

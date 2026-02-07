/**
 * useWidgetIntegration Hook
 * 
 * Unified widget integration access control - the single source of truth for:
 * 1. Widget type access check (is widget shared to this user?)
 * 2. Integration access check + fallback (which integrations can they use?)
 * 
 * Flow:
 * 1. Check widget type access (admin = always yes, non-admin = check shares)
 * 2. If widget not accessible → return 'noAccess'
 * 3. If widget accessible → check integration access via useIntegrationFallback
 * 4. Return effective integration ID and status for rendering
 * 
 * Config persistence on fallback is handled automatically by this hook.
 * When a fallback integration is used, the widget config is updated via API.
 */

import { useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { isAdmin } from '../../../utils/permissions';
import { useMyWidgetAccess } from '../../../api/hooks/useWidgetQueries';
import { useIntegrationFallback } from './useIntegrationFallback';
import { getWidgetMetadata } from '../../../widgets/registry';
import { widgetsApi } from '../../../api/endpoints';
import logger from '../../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export type WidgetIntegrationStatus =
    | 'loading'        // Still fetching access data
    | 'active'         // Has accessible integration
    | 'noAccess'       // Widget not shared to user
    | 'disabled'       // Widget shared but no integrations available
    | 'notConfigured'; // Utility widget or no integration selected

export interface AccessibleIntegration {
    id: string;
    name: string;
    type: string;
}

export interface UseWidgetIntegrationResult {
    /** The resolved integration ID to use (null if not active) */
    effectiveIntegrationId: string | null;
    /** Status for rendering decision */
    status: WidgetIntegrationStatus;
    /** Whether a fallback integration is being used (consumer should persist) */
    isFallback: boolean;
    /** Fallback integration details (if applicable) */
    fallbackInstance?: { id: string; name: string };
    /** Available integrations for dropdown (empty if no access) */
    availableIntegrations: AccessibleIntegration[];
    /** Whether current user is admin (for UI decisions like Settings link) */
    isAdmin: boolean;
    /** Loading state */
    loading: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useWidgetIntegration(
    widgetType: string,
    configuredIntegrationId?: string,
    widgetId?: string  // Optional: provide to enable automatic fallback persistence
): UseWidgetIntegrationResult {
    const { user } = useAuth();
    const hasAdminAccess = isAdmin(user);

    // Get widget metadata for compatible types
    const metadata = getWidgetMetadata(widgetType);
    const compatibleTypes = metadata?.compatibleIntegrations || [];
    const isUtilityWidget = compatibleTypes.length === 0;

    // ========================================================================
    // Widget Access Check (non-admin only)
    // ========================================================================
    const {
        data: accessData,
        isLoading: accessLoading,
    } = useMyWidgetAccess();

    const hasWidgetAccess = useMemo(() => {
        // Admins always have access
        if (hasAdminAccess) return true;

        // Utility widgets always accessible
        if (isUtilityWidget) return true;

        // Check widget type shares
        const widgets = accessData?.widgets;
        if (widgets === 'all') return true;
        if (Array.isArray(widgets)) return widgets.includes(widgetType);

        return false;
    }, [hasAdminAccess, isUtilityWidget, accessData, widgetType]);

    // ========================================================================
    // Integration Access + Fallback (only if widget accessible)
    // ========================================================================
    const fallbackResult = useIntegrationFallback({
        configuredId: configuredIntegrationId,
        compatibleTypes,
        widgetType,
    });

    // ========================================================================
    // Build Result
    // ========================================================================
    const result = useMemo<UseWidgetIntegrationResult>(() => {
        // Map compatible instances to our format
        const available: AccessibleIntegration[] = fallbackResult.compatibleInstances.map(i => ({
            id: i.id,
            name: i.displayName,
            type: i.type,
        }));

        // Loading state
        if (accessLoading || fallbackResult.loading) {
            return {
                effectiveIntegrationId: null,
                status: 'loading',
                isFallback: false,
                availableIntegrations: [],
                isAdmin: hasAdminAccess,
                loading: true,
            };
        }

        // Utility widgets - always active, no integration needed
        if (isUtilityWidget) {
            return {
                effectiveIntegrationId: null,
                status: 'notConfigured', // Utility widgets don't use integrations
                isFallback: false,
                availableIntegrations: [],
                isAdmin: hasAdminAccess,
                loading: false,
            };
        }

        // Widget not accessible to user
        if (!hasWidgetAccess) {
            return {
                effectiveIntegrationId: null,
                status: 'noAccess',
                isFallback: false,
                availableIntegrations: [],
                isAdmin: hasAdminAccess,
                loading: false,
            };
        }

        // Widget accessible - check integration status
        const { integrationId, isFallback, reason, fallbackInstance } = fallbackResult;

        if (reason === 'not_configured') {
            // No integration selected yet
            return {
                effectiveIntegrationId: null,
                status: 'notConfigured',
                isFallback: false,
                availableIntegrations: available,
                isAdmin: hasAdminAccess,
                loading: false,
            };
        }

        if (reason === 'no_access') {
            // Widget shared but no integrations available
            return {
                effectiveIntegrationId: null,
                status: 'disabled',
                isFallback: false,
                availableIntegrations: available,
                isAdmin: hasAdminAccess,
                loading: false,
            };
        }

        // Integration accessible (original or fallback)
        return {
            effectiveIntegrationId: integrationId,
            status: 'active',
            isFallback,
            fallbackInstance,
            availableIntegrations: available,
            isAdmin: hasAdminAccess,
            loading: false,
        };
    }, [
        accessLoading,
        fallbackResult,
        isUtilityWidget,
        hasWidgetAccess,
        hasAdminAccess,
    ]);

    // ========================================================================
    // Fallback Persistence (auto-persist fallback to widget config)
    // ========================================================================
    const persistedFallbackRef = useRef<string | null>(null);
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Skip if no widgetId provided (persistence disabled)
        if (!widgetId) return;

        // Skip if not a fallback situation
        if (!result.isFallback || !result.effectiveIntegrationId) {
            // Clear any pending timer if we're no longer in fallback state
            if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
            }
            return;
        }

        // Skip if we already persisted this fallback
        if (persistedFallbackRef.current === result.effectiveIntegrationId) return;

        // STABILITY DELAY: Wait 500ms before persisting to ensure this isn't a transient state
        // This prevents persisting a fallback that was triggered by a brief network hiccup
        if (fallbackTimerRef.current) {
            clearTimeout(fallbackTimerRef.current);
        }

        fallbackTimerRef.current = setTimeout(async () => {
            // Double-check we're still in the same fallback state after delay
            try {
                logger.info(`[useWidgetIntegration] Persisting fallback integration ${result.effectiveIntegrationId} for widget ${widgetId}`);
                await widgetsApi.updateWidgetConfig(widgetId, { integrationId: result.effectiveIntegrationId });
                persistedFallbackRef.current = result.effectiveIntegrationId;
                logger.info(`[useWidgetIntegration] Successfully persisted fallback for widget ${widgetId}`);
                // Trigger dashboard refetch to update local state
                window.dispatchEvent(new CustomEvent('widget-config-updated'));
            } catch (error) {
                logger.error(`[useWidgetIntegration] Failed to persist fallback for widget ${widgetId}:`, { error });
            }
        }, 500); // 500ms stability delay

        return () => {
            if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
            }
        };
    }, [widgetId, result.isFallback, result.effectiveIntegrationId]);

    return result;
}

export default useWidgetIntegration;

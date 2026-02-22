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
    /** Display name of the effective integration (for error messages) */
    effectiveDisplayName: string | undefined;
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
                effectiveDisplayName: undefined,
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
                effectiveDisplayName: undefined,
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
                effectiveDisplayName: undefined,
                status: 'noAccess',
                isFallback: false,
                availableIntegrations: [],
                isAdmin: hasAdminAccess,
                loading: false,
            };
        }

        // Widget accessible - check integration status
        const { integrationId, isFallback, reason, fallbackInstance } = fallbackResult;

        // Derive display name from available integrations
        const displayName = integrationId
            ? available.find(i => i.id === integrationId)?.name
            : undefined;

        if (reason === 'not_configured') {
            // No integration selected yet
            return {
                effectiveIntegrationId: null,
                effectiveDisplayName: undefined,
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
                effectiveDisplayName: undefined,
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
            effectiveDisplayName: displayName,
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

    // Track the latest desired fallback in a ref so the timer callback can read
    // the CURRENT value instead of the stale closure value.
    const desiredFallbackRef = useRef<string | null>(null);
    desiredFallbackRef.current = (result.isFallback && result.effectiveIntegrationId)
        ? result.effectiveIntegrationId
        : null;

    useEffect(() => {
        // Skip if no widgetId provided (persistence disabled)
        if (!widgetId) return;

        const desiredId = result.isFallback ? result.effectiveIntegrationId : null;

        // Not a fallback situation — nothing to persist
        if (!desiredId) {
            return;
        }

        // Already persisted this exact fallback
        if (persistedFallbackRef.current === desiredId) return;

        // Already have a timer running — let it check the ref when it fires.
        // Don't restart the timer on every useMemo recalculation; the ref
        // tracks the latest desired value, so the timer will read it.
        if (fallbackTimerRef.current) return;

        // STABILITY DELAY: Wait 500ms before persisting to ensure this isn't a transient state
        fallbackTimerRef.current = setTimeout(async () => {
            fallbackTimerRef.current = null;

            // Read the LATEST desired fallback from the ref (not the stale closure)
            const currentDesired = desiredFallbackRef.current;
            if (!currentDesired) {
                logger.debug(`[useWidgetIntegration] Fallback persistence cancelled — no longer in fallback state`);
                return;
            }

            // Skip if already persisted
            if (persistedFallbackRef.current === currentDesired) return;

            try {
                logger.info(`[useWidgetIntegration] Persisting fallback integration ${currentDesired} for widget ${widgetId}`);
                await widgetsApi.updateWidgetConfig(widgetId, { integrationId: currentDesired });
                persistedFallbackRef.current = currentDesired;
                logger.info(`[useWidgetIntegration] Successfully persisted fallback for widget ${widgetId}`);
                // Trigger dashboard refetch to update local state
                window.dispatchEvent(new CustomEvent('widget-config-updated'));
            } catch (error) {
                logger.error(`[useWidgetIntegration] Failed to persist fallback for widget ${widgetId}:`, { error });
            }
        }, 500);
    }, [widgetId, result.isFallback, result.effectiveIntegrationId]);

    return result;
}

export default useWidgetIntegration;

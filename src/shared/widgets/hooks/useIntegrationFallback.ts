/**
 * useIntegrationFallback Hook
 * 
 * Resolves the active integration ID for a widget, with fallback logic.
 * 
 * Flow:
 * 1. If configured integrationId is accessible → use it
 * 2. If configured integrationId is NOT accessible → try fallback
 * 3. If no fallback available → return null with reason
 * 
 * This prevents widgets from showing errors when their configured
 * integration is deleted or unshared.
 * 
 * Uses React Query for real-time reactivity to integration sharing changes.
 */

import { useMemo, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { isAdmin } from '../../../utils/permissions';
import { useRoleAwareIntegrations } from '../../../api/hooks/useIntegrations';
import logger from '../../../utils/logger';

export interface IntegrationFallbackResult {
    /** The resolved integration ID to use (or null if none available) */
    integrationId: string | null;
    /** Whether the original configured ID was used (vs fallback or null) */
    isOriginal: boolean;
    /** Whether a fallback was used */
    isFallback: boolean;
    /** Reason for null integrationId */
    reason: 'loading' | 'not_configured' | 'no_access' | 'accessible' | null;
    /** Loading state */
    loading: boolean;
    /** The fallback integration instance details (if used) */
    fallbackInstance?: { id: string; name: string };
    /** All accessible instances of compatible types (for dropdown) */
    compatibleInstances: AccessibleInstance[];
}

interface UseIntegrationFallbackOptions {
    /** The configured integration ID from widget config */
    configuredId: string | undefined;
    /** Compatible integration types for this widget (e.g., ['plex']) */
    compatibleTypes: string[];
    /** Widget type for logging */
    widgetType?: string;
}

// Export AccessibleInstance for consumers
export interface AccessibleInstance {
    id: string;
    type: string;
    displayName: string;
}

export function useIntegrationFallback({
    configuredId,
    compatibleTypes,
    widgetType = 'unknown'
}: UseIntegrationFallbackOptions): IntegrationFallbackResult {
    const { user } = useAuth();
    const hasAdminAccess = isAdmin(user);

    // Use React Query hook for real-time reactivity (role-aware)
    // Also get isFetching to detect background refetches that may cause empty data temporarily
    // LAYER 1 & 2: Get isError to detect query failures vs empty results
    const {
        data: allIntegrations = [],
        isLoading: loading,
        isFetching,
        isError,
    } = useRoleAwareIntegrations();

    // Cache the last stable (non-empty) result to use during refetching or errors
    // This prevents widgets from briefly showing wrong state during SSE reconnection
    // LAYER 2: Also protects against network errors corrupting widget display
    const lastStableResultRef = useRef<IntegrationFallbackResult | null>(null);

    // Build accessible instances from React Query data
    const accessibleInstances = useMemo<AccessibleInstance[]>(() => {
        const instanceList = Array.isArray(allIntegrations) ? allIntegrations : [];
        return instanceList
            .filter((i) => i.enabled !== false) // enabled is true or undefined
            .map((i) => ({
                id: i.id,
                type: i.type,
                displayName: i.displayName || i.name
            }));
    }, [allIntegrations]);

    // Compute the resolved integration ID
    const result = useMemo<IntegrationFallbackResult>(() => {
        // Filter to compatible types first (reused in all returns)
        const compatible = accessibleInstances.filter(i =>
            compatibleTypes.includes(i.type.toLowerCase())
        );

        // Initial loading - show loading state
        if (loading) {
            return {
                integrationId: null,
                isOriginal: false,
                isFallback: false,
                reason: 'loading',
                loading: true,
                compatibleInstances: [],
            };
        }

        // LAYER 1 & 2: STABILITY GUARD - Protect against transient failures
        // If we have a configuredId AND (refetching OR error OR empty data), use cached result
        // This prevents widgets from showing "Not Configured" during:
        // - SSE reconnection (isFetching)
        // - Network errors (isError) 
        // - Proxy timeouts that return empty data
        const isTransientFailure = (isFetching || isError || accessibleInstances.length === 0);
        if (configuredId && isTransientFailure && lastStableResultRef.current) {
            logger.debug(`[useIntegrationFallback] ${widgetType}: Using cached result (transient=${isFetching ? 'refetch' : isError ? 'error' : 'empty'})`);
            return lastStableResultRef.current;
        }

        // No configured ID - widget not configured
        if (!configuredId) {
            return {
                integrationId: null,
                isOriginal: false,
                isFallback: false,
                reason: 'not_configured',
                loading: false,
                compatibleInstances: compatible,
            };
        }

        // Check if configured ID is accessible
        const configuredIsAccessible = accessibleInstances.some(i => i.id === configuredId);

        if (configuredIsAccessible) {
            return {
                integrationId: configuredId,
                isOriginal: true,
                isFallback: false,
                reason: 'accessible',
                loading: false,
                compatibleInstances: compatible,
            };
        }

        // Configured ID is NOT accessible - try fallback
        // Find first compatible accessible instance
        const fallback = compatible[0]; // Already filtered to compatible

        if (fallback) {
            logger.info(`[useIntegrationFallback] ${widgetType}: Falling back from ${configuredId} to ${fallback.id} (${fallback.displayName})`);
            return {
                integrationId: fallback.id,
                isOriginal: false,
                isFallback: true,
                reason: 'accessible',
                loading: false,
                fallbackInstance: { id: fallback.id, name: fallback.displayName },
                compatibleInstances: compatible,
            };
        }

        // No fallback available - expected for non-admin users without shared access
        return {
            integrationId: null,
            isOriginal: false,
            isFallback: false,
            reason: 'no_access',
            loading: false,
            compatibleInstances: compatible,
        };
    }, [loading, isFetching, isError, configuredId, accessibleInstances, compatibleTypes, widgetType]);

    // Cache stable results (when we have actual data, not loading/transient states)
    // Only cache if we got a real result with integration data or a definitive "not configured" state
    // LAYER 2: Don't cache during error states either
    if (!loading && !isFetching && !isError && (result.reason === 'accessible' || accessibleInstances.length > 0)) {
        lastStableResultRef.current = result;
    }

    return result;
}

export default useIntegrationFallback;


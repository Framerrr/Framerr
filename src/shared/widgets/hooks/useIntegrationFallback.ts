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
import { useRoleAwareIntegrations } from '../../../api/hooks/useIntegrations';
import logger from '../../../utils/logger';
import { resolveEffectiveIntegrationId } from '../resolveEffectiveIntegrationId';

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
    /** When true, user intentionally cleared — do not auto-bind */
    explicitlyCleared?: boolean;
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
    widgetType = 'unknown',
    explicitlyCleared,
}: UseIntegrationFallbackOptions): IntegrationFallbackResult {
    // Use React Query hook for real-time reactivity (role-aware)
    // React Query keeps previous data during background refetches, so accessibleInstances
    // always has the last successful data (never empty during refetch).
    // isError detects query failures where we should use cached results.
    const {
        data: allIntegrations = [],
        isLoading: loading,
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

        // STABILITY GUARD: Only protect against network errors
        // React Query keeps previous data during background refetches, so isFetching is safe —
        // accessibleInstances still has old data until refetch completes atomically.
        // Empty data after a successful, non-error fetch is REAL (all integrations deleted).
        // Only isError (network failure) should use cached result to prevent flash of wrong state.
        if (configuredId && isError && lastStableResultRef.current) {
            logger.debug(`[useIntegrationFallback] ${widgetType}: Using cached result (network error)`);
            return lastStableResultRef.current;
        }

        const effectiveId = resolveEffectiveIntegrationId(
            configuredId,
            compatible,
            explicitlyCleared === true,
        );

        if (effectiveId === null) {
            return {
                integrationId: null,
                isOriginal: false,
                isFallback: false,
                reason: configuredId && !explicitlyCleared ? 'no_access' : 'not_configured',
                loading: false,
                compatibleInstances: compatible,
            };
        }

        const isOriginal = effectiveId === configuredId;
        const inst = compatible.find((i) => i.id === effectiveId);

        if (!isOriginal && inst) {
            logger.info(
                `[useIntegrationFallback] ${widgetType}: Effective bind ${effectiveId} (${inst.displayName})`,
            );
        }

        return {
            integrationId: effectiveId,
            isOriginal,
            isFallback: !isOriginal,
            reason: 'accessible',
            loading: false,
            fallbackInstance: isOriginal
                ? undefined
                : inst
                  ? { id: inst.id, name: inst.displayName }
                  : undefined,
            compatibleInstances: compatible,
        };
    }, [loading, isError, configuredId, accessibleInstances, compatibleTypes, widgetType, explicitlyCleared]);

    // Cache stable results for use during network errors
    // Any non-loading, non-error result is valid to cache (including 'not_configured' and 'no_access')
    if (!loading && !isError) {
        lastStableResultRef.current = result;
    }

    return result;
}

export default useIntegrationFallback;


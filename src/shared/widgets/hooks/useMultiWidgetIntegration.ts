/**
 * useMultiWidgetIntegration Hook
 * 
 * Multi-integration variant of useWidgetIntegration for widgets that
 * support multiple integration types simultaneously (e.g., Calendar with Sonarr + Radarr).
 * 
 * Flow:
 * 1. Check widget type access (admin = always yes, non-admin = check shares)
 * 2. If widget not accessible → return 'noAccess'
 * 3. If widget accessible → check each integration type separately
 * 4. Return effective integration IDs for each type
 * 
 * Status values:
 * - 'loading': Still fetching access data
 * - 'active': All configured integrations accessible
 * - 'partial': Some integrations accessible, some not
 * - 'noAccess': Widget not shared to user
 * - 'disabled': Widget shared but no integrations available
 * - 'notConfigured': No integrations configured
 * 
 * Uses React Query for real-time reactivity to integration sharing changes.
 */

import { useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useDashboardEdit } from '../../../context/DashboardEditContext';
import { isAdmin } from '../../../utils/permissions';
import { useMyWidgetAccess } from '../../../api/hooks/useWidgetQueries';
import { useRoleAwareIntegrations } from '../../../api/hooks/useIntegrations';
import { getWidgetMetadata } from '../../../widgets/registry';
import { widgetsApi } from '../../../api/endpoints';
import logger from '../../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export type MultiWidgetIntegrationStatus =
    | 'loading'        // Still fetching access data
    | 'active'         // All configured integrations accessible
    | 'partial'        // Some integrations accessible, some not
    | 'noAccess'       // Widget not shared to user
    | 'disabled'       // Widget shared but no integrations available
    | 'notConfigured'; // No integrations configured

export interface ResolvedIntegration {
    /** The resolved integration ID to use (null if not accessible) */
    effectiveId: string | null;
    /** The originally configured ID */
    configuredId: string | undefined;
    /** Whether a fallback was used */
    isFallback: boolean;
    /** Whether this integration is accessible */
    isAccessible: boolean;
}

export interface UseMultiWidgetIntegrationResult {
    /** Map of integration type → resolved integration info */
    integrations: Record<string, ResolvedIntegration>;
    /** Overall status for rendering decision */
    status: MultiWidgetIntegrationStatus;
    /** Whether current user is admin (for UI decisions) */
    isAdmin: boolean;
    /** Loading state */
    loading: boolean;
    /** Number of configured integrations */
    configuredCount: number;
    /** Number of accessible integrations */
    accessibleCount: number;
}

interface AccessibleInstance {
    id: string;
    type: string;
    displayName: string;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for multi-integration widgets
 * 
 * @param widgetType - The widget type (e.g., 'calendar')
 * @param configuredIntegrations - Map of integration type → configured ID
 *                                 e.g., { sonarr: 'sonarr-abc', radarr: 'radarr-xyz' }
 */
export function useMultiWidgetIntegration(
    widgetType: string,
    configuredIntegrations: Record<string, string | undefined>,
    widgetId?: string  // Optional: provide to enable automatic fallback persistence
): UseMultiWidgetIntegrationResult {
    const { user } = useAuth();
    const hasAdminAccess = isAdmin(user);

    // Get dashboard edit context to prevent persistence during edit/drag operations
    const dashboardEditContext = useDashboardEdit();
    const isEditMode = dashboardEditContext?.editMode ?? false;

    // Get widget metadata for compatible types
    const metadata = getWidgetMetadata(widgetType);
    const compatibleTypes = metadata?.compatibleIntegrations || [];


    // ========================================================================
    // Widget Access Check (non-admin only)
    // ========================================================================
    const {
        data: accessData,
        isLoading: accessLoading,
    } = useMyWidgetAccess();

    const hasWidgetAccess = useMemo(() => {
        if (hasAdminAccess) return true;
        const widgets = accessData?.widgets;
        if (widgets === 'all') return true;
        if (Array.isArray(widgets)) return widgets.includes(widgetType);
        return false;
    }, [hasAdminAccess, accessData, widgetType]);
    // ========================================================================
    // Integration Access Check (React Query for real-time reactivity)
    // ========================================================================
    // Role-aware: calls /shared for non-admin, /api/integrations for admin
    const {
        data: allIntegrations = [],
        isLoading: integrationsLoading,
    } = useRoleAwareIntegrations();

    // Build accessible instances from React Query data
    const accessibleInstances = useMemo<AccessibleInstance[]>(() => {
        const instanceList = Array.isArray(allIntegrations) ? allIntegrations : [];
        return instanceList
            .filter((i) => i.enabled !== false)
            .map((i) => ({
                id: i.id,
                type: (i.type || '').toLowerCase(),
                displayName: i.displayName || i.name
            }));
    }, [allIntegrations]);

    // ========================================================================
    // Build Result
    // ========================================================================
    const result = useMemo<UseMultiWidgetIntegrationResult>(() => {
        const isLoading = accessLoading || integrationsLoading;

        // Loading state
        if (isLoading) {
            return {
                integrations: {},
                status: 'loading',
                isAdmin: hasAdminAccess,
                loading: true,
                configuredCount: 0,
                accessibleCount: 0,
            };
        }

        // Widget not accessible to user
        if (!hasWidgetAccess) {
            return {
                integrations: {},
                status: 'noAccess',
                isAdmin: hasAdminAccess,
                loading: false,
                configuredCount: 0,
                accessibleCount: 0,
            };
        }

        // Build the integrations map
        const integrations: Record<string, ResolvedIntegration> = {};
        const integrationTypes = Object.keys(configuredIntegrations);
        let configuredCount = 0;
        let accessibleCount = 0;

        for (const integrationType of integrationTypes) {
            const configuredId = configuredIntegrations[integrationType];

            // Get accessible instances of this type
            const typeInstances = accessibleInstances.filter(
                i => i.type === integrationType.toLowerCase()
            );

            if (configuredId) {
                configuredCount++;

                // Check if configured ID is accessible
                const isAccessible = typeInstances.some(i => i.id === configuredId);

                if (isAccessible) {
                    accessibleCount++;
                    integrations[integrationType] = {
                        effectiveId: configuredId,
                        configuredId,
                        isFallback: false,
                        isAccessible: true,
                    };
                } else {
                    // Try fallback to first available of this type
                    const fallback = typeInstances[0];
                    if (fallback) {
                        accessibleCount++;
                        logger.info(`[useMultiWidgetIntegration] ${widgetType}/${integrationType}: Falling back from ${configuredId} to ${fallback.id}`);
                        integrations[integrationType] = {
                            effectiveId: fallback.id,
                            configuredId,
                            isFallback: true,
                            isAccessible: true,
                        };
                    } else {
                        integrations[integrationType] = {
                            effectiveId: null,
                            configuredId,
                            isFallback: false,
                            isAccessible: false,
                        };
                    }
                }
            } else {
                // Not configured - check if any of this type available for auto-select
                const fallback = typeInstances[0];
                integrations[integrationType] = {
                    effectiveId: fallback?.id || null,
                    configuredId: undefined,
                    isFallback: !!fallback,
                    isAccessible: !!fallback,
                };
                if (fallback) {
                    accessibleCount++;
                }
            }
        }

        // Determine overall status
        let status: MultiWidgetIntegrationStatus;
        if (configuredCount === 0 && accessibleCount === 0) {
            status = 'notConfigured';
        } else if (accessibleCount === 0) {
            status = 'disabled';
        } else if (accessibleCount < configuredCount) {
            status = 'partial';
        } else {
            status = 'active';
        }

        return {
            integrations,
            status,
            isAdmin: hasAdminAccess,
            loading: false,
            configuredCount,
            accessibleCount,
        };
    }, [
        accessLoading,
        integrationsLoading,
        hasWidgetAccess,
        hasAdminAccess,
        configuredIntegrations,
        accessibleInstances,
        widgetType,
    ]);

    // ========================================================================
    // Fallback Persistence (auto-persist fallback to widget config)
    // ========================================================================
    const persistedFallbacksRef = useRef<Record<string, string>>({});

    useEffect(() => {
        // Skip if no widgetId provided (persistence disabled)
        if (!widgetId) return;

        // Skip persistence for tentative widgets (they don't exist in the database)
        // TENTATIVE_WIDGET_ID = '__tentative__' - used during external drag
        if (widgetId.startsWith('__')) return;

        // Skip persistence for drag preview widgets (temporary, not in database)
        if (widgetId.startsWith('drag-preview-')) return;

        // Skip persistence during edit mode - widget may not be saved to DB yet
        // This prevents 404 errors when dragging new widgets that haven't been committed
        if (isEditMode) return;

        // Find integrations with fallback that haven't been persisted
        const fallbacksToPersist: Record<string, string> = {};
        for (const [integrationType, resolved] of Object.entries(result.integrations)) {
            if (
                resolved.isFallback &&
                resolved.effectiveId &&
                persistedFallbacksRef.current[integrationType] !== resolved.effectiveId
            ) {
                fallbacksToPersist[integrationType] = resolved.effectiveId;
            }
        }

        if (Object.keys(fallbacksToPersist).length === 0) return;

        // Persist the fallback integration IDs to widget config
        const persistFallbacks = async () => {
            try {
                // Build config update with the correct key names for multi-integration widgets
                // Calendar uses sonarrIntegrationId, radarrIntegrationId
                const configUpdate: Record<string, string> = {};
                for (const [integrationType, effectiveId] of Object.entries(fallbacksToPersist)) {
                    configUpdate[`${integrationType}IntegrationId`] = effectiveId;
                }

                logger.info(`[useMultiWidgetIntegration] Persisting fallback integrations for widget ${widgetId}:`, configUpdate);
                await widgetsApi.updateWidgetConfig(widgetId, configUpdate);
                logger.info(`[useMultiWidgetIntegration] Successfully persisted fallbacks for widget ${widgetId}`);

                // Trigger dashboard refetch to update local state
                window.dispatchEvent(new CustomEvent('widget-config-updated'));
            } catch (error) {
                // Revert ref on failure so retry can happen
                for (const integrationType of Object.keys(fallbacksToPersist)) {
                    delete persistedFallbacksRef.current[integrationType];
                }
                logger.error(`[useMultiWidgetIntegration] Failed to persist fallbacks for widget ${widgetId}:`, { error });
            }
        };

        // Update ref BEFORE async call to prevent duplicate runs from racing effects
        for (const [integrationType, effectiveId] of Object.entries(fallbacksToPersist)) {
            persistedFallbacksRef.current[integrationType] = effectiveId;
        }

        persistFallbacks();
    }, [widgetId, result.integrations, isEditMode]);

    return result;
}

export default useMultiWidgetIntegration;

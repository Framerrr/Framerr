/**
 * useWidgetSharing - Hook for managing widget/integration sharing
 * 
 * Provides:
 * - Fetching users and groups for the modal
 * - Fetching compatible integrations for a widget type
 * - Loading existing shares
 * - Saving updated shares
 * 
 * P2 Migration: Hybrid pattern
 * - Save: Uses React Query mutation with cache invalidation
 * - Load: Imperative parallel fetch (triggered on modal open, not on mount)
 */

import { useState, useCallback } from 'react';
import { integrationsApi, widgetSharesApi } from '../api/endpoints';
import { useSaveWidgetShares } from '../api/hooks/useWidgetQueries';
import logger from '../utils/logger';
import { useNotifications } from '../context/NotificationContext';

// ============================================================================
// Types
// ============================================================================

export interface Integration {
    id: string;
    name: string;
    type: string;
}

export interface UserData {
    id: string;
    username: string;
    displayName?: string;
}

export interface GroupData {
    id: string;
    name: string;
    users: UserData[];
}

export interface UserShareState {
    checked: boolean;
    integrations: string[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useWidgetSharing() {
    // Local state for modal data (loaded on-demand, not on mount)
    const [groups, setGroups] = useState<GroupData[]>([]);
    const [ungroupedUsers, setUngroupedUsers] = useState<UserData[]>([]);
    const [compatibleIntegrations, setCompatibleIntegrations] = useState<Integration[]>([]);
    const [initialUserShares, setInitialUserShares] = useState<Record<string, UserShareState>>({});
    const [loadingData, setLoadingData] = useState(false);

    const { success: showSuccess, error: showError } = useNotifications();

    // ========================================================================
    // Server State (React Query mutation for save)
    // ========================================================================
    const saveMutation = useSaveWidgetShares();

    // Combine loading states
    const loading = loadingData || saveMutation.isPending;

    // ========================================================================
    // Load Data (imperative - triggered on modal open)
    // ========================================================================

    /**
     * Load data needed for the share modal
     * Uses parallel fetch since this is triggered on-demand, not on mount
     */
    const loadShareData = useCallback(async (widgetType: string, compatibleTypes: string[]) => {
        setLoadingData(true);
        try {
            // Fetch users and groups in parallel with integrations
            const [usersResponse, integrationsResponse, existingResponse] = await Promise.all([
                widgetSharesApi.getUsersAndGroups(),
                integrationsApi.getAll(),
                widgetSharesApi.getExisting(widgetType, compatibleTypes)
            ]);

            // Set users and groups
            setGroups(usersResponse.groups);
            setUngroupedUsers(usersResponse.ungroupedUsers);

            // Filter integrations to compatible types and map to format needed by modal
            const allIntegrations = Array.isArray(integrationsResponse) ? integrationsResponse : [];
            const filtered = allIntegrations
                .filter(i => compatibleTypes.includes(i.type) && i.enabled)
                .map(i => ({
                    id: i.id,
                    name: i.displayName || i.name || i.id,  // displayName is what backend returns
                    type: i.type
                }));
            setCompatibleIntegrations(filtered);

            // Set existing shares
            setInitialUserShares(existingResponse.userStates || {});

            return true;
        } catch (error) {
            logger.error('[useWidgetSharing] Failed to load share data:', error);
            showError('Load Failed', 'Failed to load sharing data.');
            return false;
        } finally {
            setLoadingData(false);
        }
    }, [showError]);

    // ========================================================================
    // Save Shares (React Query mutation)
    // ========================================================================

    /**
     * Save shares for a widget type
     * @param compatibleTypes - Integration types from plugin (passed to backend to avoid map sync)
     */
    const saveShares = useCallback(async (
        widgetType: string,
        shares: { widgetShares: string[]; integrationShares: Record<string, string[]> },
        compatibleTypes: string[] = []
    ) => {
        try {
            await saveMutation.mutateAsync({
                widgetType,
                data: {
                    userShares: shares.widgetShares,
                    groupShares: [], // For now, we handle groups via individual users
                    everyoneShare: false,
                    integrationShares: shares.integrationShares,
                    compatibleTypes  // P4 Pattern: passes plugin data to backend
                }
            });

            showSuccess('Shares Updated', 'Widget sharing settings have been saved.');
            return true;
        } catch (error) {
            logger.error('[useWidgetSharing] Failed to save shares:', error);
            showError('Save Failed', 'Failed to save sharing settings.');
            return false;
        }
    }, [saveMutation, showSuccess, showError]);

    // ========================================================================
    // Return
    // ========================================================================

    return {
        loading,
        groups,
        ungroupedUsers,
        compatibleIntegrations,
        initialUserShares,
        loadShareData,
        saveShares
    };
}

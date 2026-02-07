/**
 * useNotificationSettings Hook
 * 
 * Manages all state and API operations for NotificationSettings.
 * Uses React Query for server state, local state for UI.
 */

import { useState, useCallback, useMemo } from 'react';
import { notificationsApi } from '@/api';
import { useNotifications } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import { isAdmin } from '../../../utils/permissions';
import { getDefaultAdminEvents, getDefaultUserEvents } from '../../../constants/notificationEvents';
import {
    useNotificationPreferences,
    useUpdateNotificationPreferences,
    useAdminNotificationConfig,
    useUpdateAdminWebhookConfig,
    useUpdateWebhookBaseUrl,
    NotificationPreferences
} from '../../../api/hooks/useSettings';
import { useRoleAwareIntegrations } from '../../../api/hooks/useIntegrations';
import logger from '../../../utils/logger';
import {
    IntegrationsState,
    SharedIntegration,
    WebhookConfig,
    UserIntegrationSetting,
    WebhookIntegrationDef,
    VisibleIntegrationInstance
} from '../types';
import { Star, Film, Tv, Activity } from 'lucide-react';

// ============================================================================
// Webhook Integration Definitions
// ============================================================================

export const WEBHOOK_INTEGRATIONS: WebhookIntegrationDef[] = [
    { id: 'overseerr', name: 'Overseerr', description: 'Media request notifications', icon: Star },
    { id: 'sonarr', name: 'Sonarr', description: 'TV show notifications', icon: Tv },
    { id: 'radarr', name: 'Radarr', description: 'Movie notifications', icon: Film },
    { id: 'servicemonitoring', name: 'Service Monitoring', description: 'Service uptime notifications', icon: Activity }
];

// ============================================================================
// Hook Return Type
// ============================================================================

export interface UseNotificationSettingsReturn {
    // Loading state
    loading: boolean;
    saving: boolean;

    // General settings
    notificationsEnabled: boolean;
    notificationSound: boolean;
    receiveUnmatched: boolean;
    webhookBaseUrl: string;

    // Integration data
    integrations: IntegrationsState;
    sharedIntegrations: SharedIntegration[];
    userIntegrationSettings: Record<string, UserIntegrationSetting>;
    visibleIntegrations: WebhookIntegrationDef[];  // For admin
    visibleIntegrationInstances: VisibleIntegrationInstance[];  // For users (per-instance)

    // Expanded sections UI state
    expandedSections: Record<string, boolean>;
    toggleSection: (id: string) => void;

    // Admin permissions
    hasAdminAccess: boolean;

    // General settings handlers
    handleToggleNotifications: (enabled: boolean) => Promise<void>;
    handleToggleSound: (enabled: boolean) => Promise<void>;
    handleToggleReceiveUnmatched: (enabled: boolean) => Promise<void>;

    // Test notification
    sendTestNotification: () => Promise<void>;

    // Webhook handlers
    setWebhookBaseUrl: (url: string) => void;
    saveWebhookBaseUrl: (url: string) => Promise<void>;
    resetWebhookBaseUrl: () => void;
    copyWebhookUrl: (integrationId: string) => Promise<void>;
    generateWebhookToken: (integrationId: string) => Promise<void>;

    // Config save handlers
    saveAdminWebhookConfig: (integrationId: string, webhookConfig: WebhookConfig) => Promise<void>;
    saveUserIntegrationSettings: (integrationId: string, settings: UserIntegrationSetting) => Promise<void>;

    // Web Push (from context)
    pushSupported: boolean;
    pushPermission: NotificationPermission | 'default';
    pushEnabled: boolean;
    pushSubscriptions: unknown[];
    currentEndpoint: string | null;
    globalPushEnabled: boolean;
    pushLoading: boolean;
    globalPushSaving: boolean;
    setPushLoading: (loading: boolean) => void;
    setGlobalPushSaving: (saving: boolean) => void;
    subscribeToPush: (deviceName?: string) => Promise<boolean>;
    unsubscribeFromPush: () => Promise<void>;
    removePushSubscription: (id: string) => Promise<void>;
    testPushNotification: () => Promise<boolean>;
    fetchGlobalPushStatus: () => Promise<void>;

    // Toast helpers
    showSuccess: (title: string, message: string) => void;
    showError: (title: string, message: string) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useNotificationSettings(): UseNotificationSettingsReturn {
    const {
        success: showSuccess,
        error: showError,
        // Web Push
        pushSupported,
        pushPermission,
        pushEnabled,
        pushSubscriptions,
        currentEndpoint,
        subscribeToPush,
        unsubscribeFromPush,
        removePushSubscription,
        testPushNotification,
        globalPushEnabled,
        fetchGlobalPushStatus
    } = useNotifications();

    const { user } = useAuth();
    const hasAdminAccess = isAdmin(user);

    // React Query hooks for server state
    const { data: preferencesData, isLoading: preferencesLoading } = useNotificationPreferences();
    const { data: adminConfigData, isLoading: adminConfigLoading } = useAdminNotificationConfig(hasAdminAccess);
    const updatePreferencesMutation = useUpdateNotificationPreferences();
    const updateAdminConfigMutation = useUpdateAdminWebhookConfig();
    const updateBaseUrlMutation = useUpdateWebhookBaseUrl();

    // Local UI state
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [pushLoading, setPushLoading] = useState<boolean>(false);
    const [globalPushSaving, setGlobalPushSaving] = useState<boolean>(false);
    const [localWebhookBaseUrl, setLocalWebhookBaseUrl] = useState<string>('');

    // Shared integrations for non-admin users (uses React Query for SSE invalidation)
    // Uses useRoleAwareIntegrations - same pattern as useWidgetData
    // This returns an array directly (already extracts .integrations)
    const { data: allIntegrations = [], isLoading: integrationsLoading } = useRoleAwareIntegrations();

    // For non-admin, allIntegrations IS the shared integrations list
    const sharedIntegrations: SharedIntegration[] = useMemo(() => {
        if (hasAdminAccess) return [];
        return (allIntegrations as unknown as SharedIntegration[]) || [];
    }, [hasAdminAccess, allIntegrations]);

    // Derive values from React Query data
    const notificationsEnabled = preferencesData?.enabled ?? true;
    const notificationSound = preferencesData?.sound ?? false;
    const receiveUnmatched = preferencesData?.receiveUnmatched ?? true;
    const userIntegrationSettings = preferencesData?.integrations ?? {};

    const integrations = useMemo(() => {
        if (hasAdminAccess) {
            return (adminConfigData?.integrations || {}) as IntegrationsState;
        }
        // For non-admin, build from shared integrations
        // Note: /shared API returns config.webhookConfig, not top-level webhookConfig
        const integrationsData: IntegrationsState = {};
        sharedIntegrations.forEach(si => {
            const config = (si as unknown as { config?: { webhookConfig?: WebhookConfig } }).config;
            integrationsData[si.name] = {
                enabled: si.enabled,
                webhookConfig: config?.webhookConfig || si.webhookConfig || undefined
            };
        });
        return integrationsData;
    }, [hasAdminAccess, adminConfigData, sharedIntegrations]);

    const webhookBaseUrl = localWebhookBaseUrl || adminConfigData?.webhookBaseUrl || window.location.origin;

    // Derived loading state
    const loading = preferencesLoading || (hasAdminAccess && adminConfigLoading);
    const saving = updatePreferencesMutation.isPending ||
        updateAdminConfigMutation.isPending ||
        updateBaseUrlMutation.isPending;

    // Note: sharedIntegrations now comes from useSharedIntegrations hook (React Query)
    // This enables SSE-based invalidation when admin changes sharing or webhook config

    // ========================================================================
    // General Settings Handlers
    // ========================================================================

    const buildPreferencesPayload = useCallback((updates: Partial<NotificationPreferences>): NotificationPreferences => ({
        enabled: updates.enabled ?? notificationsEnabled,
        sound: updates.sound ?? notificationSound,
        receiveUnmatched: updates.receiveUnmatched ?? receiveUnmatched,
        integrations: userIntegrationSettings as NotificationPreferences['integrations']
    }), [notificationsEnabled, notificationSound, receiveUnmatched, userIntegrationSettings]);

    const handleToggleNotifications = useCallback(async (enabled: boolean): Promise<void> => {
        await updatePreferencesMutation.mutateAsync(buildPreferencesPayload({ enabled }));
    }, [updatePreferencesMutation, buildPreferencesPayload]);

    const handleToggleSound = useCallback(async (enabled: boolean): Promise<void> => {
        await updatePreferencesMutation.mutateAsync(buildPreferencesPayload({ sound: enabled }));
    }, [updatePreferencesMutation, buildPreferencesPayload]);

    const handleToggleReceiveUnmatched = useCallback(async (enabled: boolean): Promise<void> => {
        await updatePreferencesMutation.mutateAsync(buildPreferencesPayload({ receiveUnmatched: enabled }));
    }, [updatePreferencesMutation, buildPreferencesPayload]);

    // ========================================================================
    // Test Notification
    // ========================================================================

    const sendTestNotification = useCallback(async (): Promise<void> => {
        try {
            await notificationsApi.create({
                title: 'Test Notification',
                message: 'This is a test notification to demonstrate how notifications appear!',
                type: 'info'
            });
        } catch (error) {
            logger.error('Failed to create test notification:', error);
            showError('Error', 'Failed to create test notification');
        }
    }, [showError]);

    // ========================================================================
    // Webhook Config Handlers
    // ========================================================================

    const saveWebhookBaseUrl = useCallback(async (url: string): Promise<void> => {
        try {
            await updateBaseUrlMutation.mutateAsync(url);
            setLocalWebhookBaseUrl(url);
            showSuccess('Saved', 'Webhook base URL updated');
        } catch (error) {
            logger.error('Failed to save webhook base URL:', error);
            showError('Error', 'Failed to save webhook base URL');
        }
    }, [updateBaseUrlMutation, showSuccess, showError]);

    const resetWebhookBaseUrl = useCallback((): void => {
        const browserUrl = window.location.origin;
        setLocalWebhookBaseUrl(browserUrl);
        saveWebhookBaseUrl(browserUrl);
    }, [saveWebhookBaseUrl]);

    const copyWebhookUrl = useCallback(async (integrationId: string): Promise<void> => {
        const integration = integrations[integrationId];
        const webhookConfig = integration?.webhookConfig;

        if (webhookConfig?.webhookToken) {
            const baseUrl = webhookBaseUrl || window.location.origin;
            const url = `${baseUrl}/api/webhooks/${integrationId}/${webhookConfig.webhookToken}`;

            try {
                await navigator.clipboard.writeText(url);
                showSuccess('Copied', 'Webhook URL copied to clipboard');
            } catch (err) {
                logger.error('Clipboard API failed, trying fallback', err);
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = url;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-9999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    const success = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    if (success) {
                        showSuccess('Copied', 'Webhook URL copied to clipboard');
                    } else {
                        showError('Copy Failed', 'Unable to copy to clipboard');
                    }
                } catch (fallbackErr) {
                    logger.error('Fallback copy also failed', fallbackErr);
                    showError('Copy Failed', 'Unable to copy to clipboard. Please copy manually.');
                }
            }
        } else {
            showError('No Token', 'Generate a webhook token first by enabling notifications for this integration');
        }
    }, [integrations, webhookBaseUrl, showSuccess, showError]);

    const saveAdminWebhookConfig = useCallback(async (integrationId: string, webhookConfig: WebhookConfig): Promise<void> => {
        try {
            const updatedIntegrations = {
                ...integrations,
                [integrationId]: {
                    ...integrations[integrationId],
                    webhookConfig
                }
            };

            await updateAdminConfigMutation.mutateAsync({ integrations: updatedIntegrations });
        } catch (error) {
            logger.error('Failed to save webhook config:', error);
            showError('Error', 'Failed to save notification settings');
        }
    }, [integrations, updateAdminConfigMutation, showError]);

    const generateWebhookToken = useCallback(async (integrationId: string): Promise<void> => {
        const token = typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        const currentConfig = integrations[integrationId]?.webhookConfig || {};

        await saveAdminWebhookConfig(integrationId, {
            ...currentConfig,
            webhookToken: token,
            webhookEnabled: true,
            adminEvents: currentConfig.adminEvents || getDefaultAdminEvents(integrationId),
            userEvents: currentConfig.userEvents || getDefaultUserEvents(integrationId)
        });

        showSuccess('Token Generated', 'New webhook token created');
    }, [integrations, saveAdminWebhookConfig, showSuccess]);

    // ========================================================================
    // User Integration Settings
    // ========================================================================

    const saveUserIntegrationSettings = useCallback(async (integrationId: string, settings: UserIntegrationSetting): Promise<void> => {
        const updated = {
            ...userIntegrationSettings,
            [integrationId]: settings
        } as NotificationPreferences['integrations'];

        try {
            await updatePreferencesMutation.mutateAsync({
                enabled: notificationsEnabled,
                sound: notificationSound,
                receiveUnmatched,
                integrations: updated
            });
        } catch (error) {
            logger.error('Failed to save user notification settings:', error);
        }
    }, [userIntegrationSettings, notificationsEnabled, notificationSound, receiveUnmatched, updatePreferencesMutation]);

    // ========================================================================
    // UI Helpers
    // ========================================================================

    const toggleSection = useCallback((id: string): void => {
        setExpandedSections(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    }, []);

    const visibleIntegrations = useMemo(() => {
        if (hasAdminAccess) {
            return WEBHOOK_INTEGRATIONS.filter(integration => {
                const config = integrations[integration.id];
                if (integration.id === 'servicemonitoring') {
                    return config?.enabled && config?.isConfigured;
                }
                return config?.enabled && config?.url && config?.apiKey;
            });
        }

        return WEBHOOK_INTEGRATIONS.filter(integration => {
            const isShared = sharedIntegrations.some(si => si.name === integration.id);
            const webhookConfig = integrations[integration.id]?.webhookConfig;
            const hasUserEvents = webhookConfig?.userEvents && webhookConfig.userEvents.length > 0;
            return isShared && hasUserEvents;
        });
    }, [hasAdminAccess, integrations, sharedIntegrations]);

    // Per-instance visible integrations for users (shows each instance with its displayName)
    const visibleIntegrationInstances = useMemo((): VisibleIntegrationInstance[] => {
        if (hasAdminAccess) {
            return []; // Admin uses visibleIntegrations
        }

        // Get integration type metadata for descriptions
        const getDescription = (type: string) => {
            const def = WEBHOOK_INTEGRATIONS.find(i => i.id === type);
            return def?.description || 'Notifications';
        };

        return sharedIntegrations
            .filter(si => {
                // Must have userEvents configured
                const webhookConfig = si.config?.webhookConfig || si.webhookConfig;
                return webhookConfig?.userEvents && webhookConfig.userEvents.length > 0;
            })
            .map(si => ({
                instanceId: si.id,
                type: si.name || si.type,
                displayName: si.displayName || si.name || si.type,
                description: getDescription(si.name || si.type),
                webhookConfig: (si.config?.webhookConfig || si.webhookConfig) as WebhookConfig
            }));
    }, [hasAdminAccess, sharedIntegrations]);

    // ========================================================================
    // Return
    // ========================================================================

    return {
        // Loading state
        loading,
        saving,

        // General settings
        notificationsEnabled,
        notificationSound,
        receiveUnmatched,
        webhookBaseUrl,

        // Integration data
        integrations,
        sharedIntegrations,
        userIntegrationSettings,
        visibleIntegrations,
        visibleIntegrationInstances,

        // Expanded sections UI state
        expandedSections,
        toggleSection,

        // Admin permissions
        hasAdminAccess,

        // General settings handlers
        handleToggleNotifications,
        handleToggleSound,
        handleToggleReceiveUnmatched,

        // Test notification
        sendTestNotification,

        // Webhook handlers
        setWebhookBaseUrl: setLocalWebhookBaseUrl,
        saveWebhookBaseUrl,
        resetWebhookBaseUrl,
        copyWebhookUrl,
        generateWebhookToken,

        // Config save handlers
        saveAdminWebhookConfig,
        saveUserIntegrationSettings,

        // Web Push (from context)
        pushSupported,
        pushPermission: pushPermission || 'default',
        pushEnabled,
        pushSubscriptions: pushSubscriptions || [],
        currentEndpoint: currentEndpoint || null,
        globalPushEnabled,
        pushLoading,
        globalPushSaving,
        setPushLoading,
        setGlobalPushSaving,
        subscribeToPush,
        unsubscribeFromPush,
        removePushSubscription,
        testPushNotification,
        fetchGlobalPushStatus,

        // Toast helpers
        showSuccess,
        showError
    };
}

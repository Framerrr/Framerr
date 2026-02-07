/**
 * NotificationSettings Component (Thin Orchestrator)
 * 
 * Settings for configuring notification preferences including:
 * - Global enable/disable and sound settings
 * - Web Push notification configuration
 * - Per-integration webhook notification controls
 */

import React from 'react';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { SettingsPage } from '../../shared/ui/settings';
import { useNotificationSettings } from './hooks/useNotificationSettings';
import { GeneralSection } from './sections/GeneralSection';
import { WebPushSection } from './sections/WebPushSection';
import { IntegrationsSection } from './sections/IntegrationsSection';

// ============================================================================
// NotificationSettings Component
// ============================================================================

export function NotificationSettings(): React.ReactElement {
    const settings = useNotificationSettings();

    if (settings.loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="lg" message="Loading settings..." />
            </div>
        );
    }

    return (
        <SettingsPage
            title="Notifications"
            description="Configure notification preferences and integrations"
        >
            {/* General Settings Section */}
            <GeneralSection
                notificationsEnabled={settings.notificationsEnabled}
                notificationSound={settings.notificationSound}
                receiveUnmatched={settings.receiveUnmatched}
                hasAdminAccess={settings.hasAdminAccess}
                onToggleNotifications={settings.handleToggleNotifications}
                onToggleSound={settings.handleToggleSound}
                onToggleReceiveUnmatched={settings.handleToggleReceiveUnmatched}
                onSendTestNotification={settings.sendTestNotification}
            />

            {/* Web Push Notifications Section */}
            <WebPushSection
                pushSupported={settings.pushSupported}
                pushPermission={settings.pushPermission}
                pushEnabled={settings.pushEnabled}
                pushSubscriptions={settings.pushSubscriptions}
                currentEndpoint={settings.currentEndpoint}
                globalPushEnabled={settings.globalPushEnabled}
                pushLoading={settings.pushLoading}
                notificationsEnabled={settings.notificationsEnabled}
                hasAdminAccess={settings.hasAdminAccess}
                globalPushSaving={settings.globalPushSaving}
                subscribeToPush={settings.subscribeToPush}
                unsubscribeFromPush={settings.unsubscribeFromPush}
                removePushSubscription={settings.removePushSubscription}
                testPushNotification={settings.testPushNotification}
                fetchGlobalPushStatus={settings.fetchGlobalPushStatus}
                setPushLoading={settings.setPushLoading}
                setGlobalPushSaving={settings.setGlobalPushSaving}
                showSuccess={settings.showSuccess}
                showError={settings.showError}
            />

            {/* Integration Notifications Section */}
            <IntegrationsSection
                webhookBaseUrl={settings.webhookBaseUrl}
                hasAdminAccess={settings.hasAdminAccess}
                setWebhookBaseUrl={settings.setWebhookBaseUrl}
                saveWebhookBaseUrl={settings.saveWebhookBaseUrl}
                resetWebhookBaseUrl={settings.resetWebhookBaseUrl}
                visibleIntegrationInstances={settings.visibleIntegrationInstances}
                userIntegrationSettings={settings.userIntegrationSettings}
                expandedSections={settings.expandedSections}
                toggleSection={settings.toggleSection}
                saveUserIntegrationSettings={settings.saveUserIntegrationSettings}
                visibleIntegrations={settings.visibleIntegrations}
                integrations={settings.integrations}
            />
        </SettingsPage>
    );
}

export default NotificationSettings;


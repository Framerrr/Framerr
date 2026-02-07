/**
 * GeneralSection Component
 * 
 * General notification settings including enable/disable, sound, and test notifications.
 * Uses settings primitives for consistent styling and animations.
 */

import React from 'react';
import { Bell, Volume2, VolumeX, Play, AlertTriangle } from 'lucide-react';
import { Button, Switch } from '../../../shared/ui';
import { SettingsSection, SettingsItem } from '../../../shared/ui/settings';

// ============================================================================
// Props
// ============================================================================

interface GeneralSectionProps {
    notificationsEnabled: boolean;
    notificationSound: boolean;
    receiveUnmatched: boolean;
    hasAdminAccess: boolean;
    onToggleNotifications: (enabled: boolean) => Promise<void>;
    onToggleSound: (enabled: boolean) => Promise<void>;
    onToggleReceiveUnmatched: (enabled: boolean) => Promise<void>;
    onSendTestNotification: () => Promise<void>;
}

// ============================================================================
// Component
// ============================================================================

export function GeneralSection({
    notificationsEnabled,
    notificationSound,
    receiveUnmatched,
    hasAdminAccess,
    onToggleNotifications,
    onToggleSound,
    onToggleReceiveUnmatched,
    onSendTestNotification
}: GeneralSectionProps): React.ReactElement {
    return (
        <SettingsSection title="General Settings" icon={Bell}>
            {/* Master Enable Toggle */}
            <SettingsItem
                label="Enable Notifications"
                description={notificationsEnabled
                    ? 'Receive toast notifications for important events'
                    : 'All notifications are disabled'}
            >
                <Switch
                    checked={notificationsEnabled}
                    onCheckedChange={onToggleNotifications}
                />
            </SettingsItem>

            {/* Sound Toggle */}
            <SettingsItem
                label="Notification Sound"
                description={notificationSound
                    ? 'Play a sound when notifications appear'
                    : 'Notifications are silent'}
                icon={notificationSound ? Volume2 : VolumeX}
                iconColor={notificationSound ? 'text-accent' : 'text-theme-tertiary'}
                disabled={!notificationsEnabled}
            >
                <Switch
                    checked={notificationSound}
                    onCheckedChange={onToggleSound}
                    disabled={!notificationsEnabled}
                />
            </SettingsItem>

            {/* Receive Unmatched - Admin Only */}
            {hasAdminAccess && (
                <SettingsItem
                    label="Receive Unmatched Alerts"
                    description="Receive notifications when webhook events can't be matched to a user"
                    icon={AlertTriangle}
                    iconColor="text-warning"
                    disabled={!notificationsEnabled}
                >
                    <Switch
                        checked={receiveUnmatched}
                        onCheckedChange={onToggleReceiveUnmatched}
                        disabled={!notificationsEnabled}
                    />
                </SettingsItem>
            )}

            {/* Test Notification */}
            <SettingsItem
                label="Test Notifications"
                description="Send a test notification to preview how notifications will appear."
                icon={Play}
                iconColor="text-accent"
                disabled={!notificationsEnabled}
            >
                <Button
                    onClick={onSendTestNotification}
                    disabled={!notificationsEnabled}
                    variant="secondary"
                    size="sm"
                >
                    Send Test
                </Button>
            </SettingsItem>
        </SettingsSection>
    );
}

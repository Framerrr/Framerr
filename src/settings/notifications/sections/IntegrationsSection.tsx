/**
 * IntegrationsSection Component
 * 
 * Phase 7d Refactor: Integration-specific webhook config moved to instance modals.
 * This section now shows:
 * - Admin: Base URL configuration + link to Service Settings
 * - User: Event preferences for integrations shared with them (per-instance)
 */

import React, { ChangeEvent } from 'react';
import { Zap, Link, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { SettingsSection, SettingsAlert } from '../../../shared/ui/settings';
import IntegrationCard from '../components/IntegrationCard';
import {
    IntegrationsState,
    UserIntegrationSetting,
    WebhookIntegrationDef,
    VisibleIntegrationInstance
} from '../types';

// ============================================================================
// Props
// ============================================================================

interface IntegrationsSectionProps {
    webhookBaseUrl: string;
    hasAdminAccess: boolean;
    setWebhookBaseUrl: (url: string) => void;
    saveWebhookBaseUrl: (url: string) => Promise<void>;
    resetWebhookBaseUrl: () => void;
    // Integration data for user view (per-instance)
    visibleIntegrationInstances?: VisibleIntegrationInstance[];
    userIntegrationSettings?: Record<string, UserIntegrationSetting>;
    expandedSections?: Record<string, boolean>;
    toggleSection?: (id: string) => void;
    saveUserIntegrationSettings?: (instanceId: string, settings: UserIntegrationSetting) => Promise<void>;
    // Legacy props (admin uses these via WEBHOOK_INTEGRATIONS)
    visibleIntegrations?: WebhookIntegrationDef[];
    integrations?: IntegrationsState;
}

// ============================================================================
// Component
// ============================================================================

export function IntegrationsSection({
    webhookBaseUrl,
    hasAdminAccess,
    setWebhookBaseUrl,
    saveWebhookBaseUrl,
    resetWebhookBaseUrl,
    visibleIntegrationInstances = [],
    userIntegrationSettings = {},
    expandedSections = {},
    toggleSection = () => { },
    saveUserIntegrationSettings = async () => { },
    // Legacy props (not used for per-instance view)
    visibleIntegrations = [],
    integrations = {}
}: IntegrationsSectionProps): React.ReactElement | null {

    // User view: Show per-instance integration cards
    if (!hasAdminAccess) {
        if (visibleIntegrationInstances.length === 0) {
            return null; // No integrations shared with user
        }

        return (
            <SettingsSection
                title="Integration Notifications"
                icon={Zap}
                description="Choose which notifications you want to receive from shared integrations."
                noAnimation={true}
            >
                <div className="space-y-4">
                    {visibleIntegrationInstances.map(instance => (
                        <IntegrationCard
                            key={instance.instanceId}
                            integrationInstance={instance}
                            userSettings={userIntegrationSettings[instance.instanceId] || { enabled: true, events: [] }}
                            isExpanded={expandedSections[instance.instanceId] || false}
                            onToggleExpand={() => toggleSection(instance.instanceId)}
                            isAdmin={false}
                            onSaveUserSettings={(settings) => saveUserIntegrationSettings(instance.instanceId, settings)}
                            disabled={false}
                        />
                    ))}
                </div>
            </SettingsSection>
        );
    }

    // Admin view: Base URL config + link to Service Settings
    return (
        <SettingsSection
            title="Integration Notifications"
            icon={Zap}
            description="Configure notifications. Set up webhooks in Service Settings for compatible integrations."
        >
            {/* Webhook Base URL Config - Admin Only */}
            <div className="p-4 bg-theme-tertiary rounded-xl border border-theme">
                <div className="flex items-center gap-2 mb-2">
                    <Link size={16} className="text-theme-secondary" />
                    <h4 className="text-sm font-medium text-theme-primary">
                        Webhook Base URL
                    </h4>
                </div>
                <p className="text-xs text-theme-secondary mb-3">
                    Base URL for webhook endpoints. Use internal Docker hostnames (e.g., http://framerr:3001) for container-to-container communication.
                </p>
                <div className="flex flex-col gap-2">
                    <input
                        type="text"
                        value={webhookBaseUrl}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setWebhookBaseUrl(e.target.value)}
                        placeholder="http://framerr:3001"
                        className="w-full px-3 py-2 text-sm bg-theme-primary border border-theme rounded-lg text-theme-primary placeholder-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <div className="flex gap-2">
                        <Button
                            onClick={() => saveWebhookBaseUrl(webhookBaseUrl)}
                            variant="secondary"
                            icon={Check}
                            title="Save webhook base URL"
                            className="flex-1 sm:flex-none"
                        >
                            Save
                        </Button>
                        <Button
                            onClick={resetWebhookBaseUrl}
                            variant="secondary"
                            icon={RefreshCw}
                            title="Reset to browser URL"
                            className="flex-1 sm:flex-none"
                        >
                            Reset
                        </Button>
                    </div>
                </div>

                {/* Warning about stale URLs */}
                <SettingsAlert type="warning" className="mt-4">
                    Changing this URL will require reconfiguring webhooks in external services.
                </SettingsAlert>
            </div>

            {/* Link to Service Settings */}
            <div className="mt-4 p-4 bg-theme-tertiary rounded-xl border border-theme">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-theme-primary">
                        Configure Webhooks
                    </span>
                    <Button
                        variant="secondary"
                        icon={ExternalLink}
                        onClick={() => {
                            window.location.hash = '#settings/integrations/services';
                        }}
                    >
                        Service Settings
                    </Button>
                </div>
            </div>
        </SettingsSection>
    );
}


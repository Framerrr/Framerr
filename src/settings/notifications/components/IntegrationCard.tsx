/**
 * IntegrationCard Component
 * 
 * Expandable card for a single integration's notification settings.
 */

import React, { MouseEvent } from 'react';
import { ChevronDown, Copy, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Switch, MultiSelectDropdown } from '../../../shared/ui';
import { INTEGRATION_EVENTS } from '../../../constants/notificationEvents';
import {
    WebhookConfig,
    IntegrationConfig,
    UserIntegrationSetting,
    WebhookIntegrationDef,
    IntegrationEvent,
    VisibleIntegrationInstance
} from '../types';

// ============================================================================
// Component Props
// ============================================================================

// Admin mode props
interface AdminModeProps {
    isAdmin: true;
    integration: WebhookIntegrationDef;
    integrationConfig: IntegrationConfig;
    onSaveAdminConfig: (config: WebhookConfig) => void;
    onCopyWebhookUrl: () => void;
    onGenerateToken: () => void;
    webhookBaseUrl: string;
}

// User mode props (per-instance)
interface UserModeProps {
    isAdmin: false;
    integrationInstance: VisibleIntegrationInstance;
}

// Common props
interface CommonProps {
    userSettings: UserIntegrationSetting;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onSaveUserSettings: (settings: UserIntegrationSetting) => void;
    disabled: boolean;
}

export type IntegrationCardProps = CommonProps & (AdminModeProps | UserModeProps);

// ============================================================================
// IntegrationCard Component
// ============================================================================

const IntegrationCard: React.FC<IntegrationCardProps> = (props) => {
    const {
        userSettings,
        isExpanded,
        onToggleExpand,
        onSaveUserSettings,
        disabled,
        isAdmin
    } = props;

    // Extract mode-specific data
    const integrationId = isAdmin
        ? props.integration.id
        : props.integrationInstance.type;
    const displayName = isAdmin
        ? props.integration.name
        : props.integrationInstance.displayName;
    const description = isAdmin
        ? props.integration.description
        : props.integrationInstance.description;
    const Icon = isAdmin ? props.integration.icon : Zap; // Default icon for user mode

    const webhookConfig = isAdmin
        ? (props.integrationConfig.webhookConfig || {})
        : props.integrationInstance.webhookConfig;

    const events: IntegrationEvent[] = (INTEGRATION_EVENTS as Record<string, IntegrationEvent[]>)[integrationId] || [];

    // Admin state
    const adminEvents = webhookConfig.adminEvents || [];
    const userEvents = webhookConfig.userEvents || [];
    const webhookEnabled = webhookConfig.webhookEnabled ?? false;
    const webhookToken = webhookConfig.webhookToken;

    // User state
    const userEnabled = userSettings.enabled ?? true;
    const userSelectedEvents = userSettings.events || [];

    const handleMasterToggle = (): void => {
        if (isAdmin) {
            props.onSaveAdminConfig({
                ...webhookConfig,
                webhookEnabled: !webhookEnabled
            });
        } else {
            onSaveUserSettings({
                ...userSettings,
                enabled: !userEnabled
            });
        }
    };

    const handleAdminEventsChange = (newEvents: string[]): void => {
        if (isAdmin) {
            props.onSaveAdminConfig({
                ...webhookConfig,
                adminEvents: newEvents
            });
        }
    };

    const handleUserEventsChange = (newEvents: string[]): void => {
        if (isAdmin) {
            props.onSaveAdminConfig({
                ...webhookConfig,
                userEvents: newEvents
            });
        }
    };

    const handleUserSelectedEventsChange = (newEvents: string[]): void => {
        onSaveUserSettings({
            ...userSettings,
            events: newEvents
        });
    };

    const isEnabled = isAdmin ? webhookEnabled : userEnabled;

    // For users, filter events to only show what admin has allowed
    const allowedEventsForUser = events.filter(e => userEvents.includes(e.key));

    return (
        <div className="bg-theme-tertiary rounded-xl overflow-hidden border border-theme">
            {/* Header - Clickable */}
            <div
                role="button"
                tabIndex={0}
                onClick={onToggleExpand}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
                className="w-full p-6 flex items-center justify-between hover:bg-theme-hover/30 transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-4 flex-1">
                    <Icon className="text-theme-secondary" size={20} />
                    <div className="flex-1 min-w-0 text-left">
                        <h3 className="font-semibold text-theme-primary">{displayName}</h3>
                        <p className="text-sm text-theme-secondary">{description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Toggle Switch */}
                    <div onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
                        <Switch
                            checked={isEnabled}
                            onCheckedChange={handleMasterToggle}
                            disabled={disabled}
                        />
                    </div>

                    {/* Chevron */}
                    <ChevronDown size={20} className={`text-theme-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-6 pb-6 border-t border-theme pt-6 space-y-6">
                            {isAdmin ? (
                                // Admin View
                                <>
                                    {/* Admin Events Dropdown */}
                                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                        <span className="text-sm font-medium text-theme-primary">Admin Receives</span>
                                        <MultiSelectDropdown
                                            options={events.map(e => ({ id: e.key, label: e.label }))}
                                            selectedIds={adminEvents}
                                            onChange={handleAdminEventsChange}
                                            disabled={disabled || !isEnabled}
                                            placeholder="Select events for admins..."
                                            size="md"
                                        />
                                    </div>

                                    {/* User Events Dropdown */}
                                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                        <span className="text-sm font-medium text-theme-primary">Users Can Receive</span>
                                        <MultiSelectDropdown
                                            options={events.map(e => ({ id: e.key, label: e.label }))}
                                            selectedIds={userEvents}
                                            onChange={handleUserEventsChange}
                                            disabled={disabled || !isEnabled}
                                            placeholder="Select events users can opt into..."
                                            size="md"
                                        />
                                    </div>

                                    {/* Webhook Configuration - Only for external webhook integrations */}
                                    {integrationId !== 'servicemonitoring' && (
                                        <div className="pt-4 border-t border-theme">
                                            <h4 className="text-sm font-medium text-theme-primary mb-3">
                                                Webhook Configuration
                                            </h4>

                                            {webhookToken ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 px-3 py-2 bg-theme-primary border border-theme rounded-lg text-xs font-mono text-theme-secondary truncate">
                                                            {`${props.webhookBaseUrl || window.location.origin}/api/webhooks/${integrationId}/${webhookToken.substring(0, 8)}...`}
                                                        </div>
                                                        <button
                                                            onClick={props.onCopyWebhookUrl}
                                                            className="p-2 bg-theme-tertiary hover:bg-theme-hover border border-theme rounded-lg transition-colors"
                                                            title="Copy full URL"
                                                        >
                                                            <Copy size={16} className="text-theme-secondary" />
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-theme-tertiary">
                                                        Configure this URL in {displayName} → Settings → Webhooks. Enable all notification types.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="text-center py-4">
                                                    <p className="text-sm text-theme-secondary mb-3">
                                                        Generate a webhook token to receive notifications from {displayName}.
                                                    </p>
                                                    <Button
                                                        onClick={props.onGenerateToken}
                                                        variant="secondary"
                                                        size="sm"
                                                        icon={Zap}
                                                    >
                                                        Generate Webhook Token
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                // User View
                                <>
                                    {allowedEventsForUser.length > 0 ? (
                                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                            <span className="text-sm font-medium text-theme-primary">Notify Me When</span>
                                            <MultiSelectDropdown
                                                options={allowedEventsForUser.map(e => ({ id: e.key, label: e.label }))}
                                                selectedIds={userSelectedEvents}
                                                onChange={handleUserSelectedEventsChange}
                                                disabled={disabled || !isEnabled}
                                                placeholder="Select which events to receive..."
                                                size="md"
                                            />
                                        </div>
                                    ) : (
                                        <p className="text-sm text-theme-tertiary text-center py-4">
                                            No notification events are currently available for this integration.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default IntegrationCard;

/**
 * ServiceSettingsGrid - Responsive grid of service cards with modal configuration
 * Cards maintain consistent size, grid columns decrease at breakpoints
 * 
 * P4 Phase 4.4: Accepts optional schemas prop for dynamic form generation.
 * Simple services use StandardIntegrationForm, complex services use render props.
 */

import React, { useState, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import ServiceCard from './ServiceCard';
import IntegrationTypeCard from './IntegrationTypeCard';
import ServiceConfigModal from './ServiceConfigModal';
import StandardIntegrationForm from '../../../integrations/_core/StandardIntegrationForm';
import { hasCustomForm } from '../../../integrations/_core/formRegistry';
import { getIntegrationIcon } from '../../../integrations/_core/iconMapping';
import {
    CATEGORY_ORDER,
    IntegrationConfig,
    TestState,
    type ServiceDefinition
} from '../../../integrations/_core/definitions';
import type { IntegrationSchemaInfo } from '../../../api/endpoints/integrations';
import { IntegrationNotificationsTab, NotificationEvent, NotificationConfigData } from '../../../shared/ui';

// Types that support webhooks (temporary until schema-driven)
const WEBHOOK_SUPPORTED_TYPES = ['sonarr', 'radarr', 'overseerr', 'monitor', 'uptimekuma'];

// Types that use 'local' mode (internal status notifications, no external webhook URL)
const LOCAL_NOTIFICATION_TYPES = ['monitor', 'uptimekuma'];

// Demo webhook events per type (temporary until schema-driven)
const WEBHOOK_EVENTS: Record<string, NotificationEvent[]> = {
    sonarr: [
        { key: 'grab', label: 'Episode Grabbed', category: 'download', defaultAdmin: true },
        { key: 'download', label: 'Episode Downloaded', category: 'download', defaultAdmin: true },
        { key: 'upgrade', label: 'Episode Upgraded', category: 'download' },
        { key: 'importComplete', label: 'Import Complete', category: 'download' },
        { key: 'rename', label: 'Episode Renamed', category: 'library' },
        { key: 'seriesAdd', label: 'Series Added', category: 'library' },
        { key: 'seriesDelete', label: 'Series Removed', category: 'library' },
        { key: 'episodeFileDelete', label: 'Episode Deleted', category: 'library' },
        { key: 'healthIssue', label: 'Health Issue', category: 'system', defaultAdmin: true },
        { key: 'healthRestored', label: 'Health Restored', category: 'system' },
        { key: 'applicationUpdate', label: 'Update Available', category: 'system' },
        { key: 'manualInteractionRequired', label: 'Manual Action Required', category: 'system', defaultAdmin: true },
        { key: 'test', label: 'Test', category: 'system', defaultAdmin: true, defaultUser: false },
    ],
    radarr: [
        { key: 'grab', label: 'Movie Grabbed', category: 'download', defaultAdmin: true },
        { key: 'download', label: 'Movie Downloaded', category: 'download', defaultAdmin: true },
        { key: 'upgrade', label: 'Movie Upgraded', category: 'download' },
        { key: 'importComplete', label: 'Import Complete', category: 'download' },
        { key: 'rename', label: 'Movie Renamed', category: 'library' },
        { key: 'movieAdded', label: 'Movie Added', category: 'library' },
        { key: 'movieDelete', label: 'Movie Removed', category: 'library' },
        { key: 'movieFileDelete', label: 'Movie File Deleted', category: 'library' },
        { key: 'healthIssue', label: 'Health Issue', category: 'system', defaultAdmin: true },
        { key: 'healthRestored', label: 'Health Restored', category: 'system' },
        { key: 'applicationUpdate', label: 'Update Available', category: 'system' },
        { key: 'manualInteractionRequired', label: 'Manual Action Required', category: 'system', defaultAdmin: true },
        { key: 'test', label: 'Test', category: 'system', defaultAdmin: true, defaultUser: false },
    ],
    overseerr: [
        { key: 'requestPending', label: 'Request Pending', category: 'request', adminOnly: true, defaultAdmin: true },
        { key: 'requestApproved', label: 'Request Approved', category: 'request', defaultAdmin: true, defaultUser: true },
        { key: 'requestAutoApproved', label: 'Auto-Approved', category: 'request', defaultAdmin: true, defaultUser: true },
        { key: 'requestAvailable', label: 'Now Available', category: 'request', defaultAdmin: true, defaultUser: true },
        { key: 'requestDeclined', label: 'Request Declined', category: 'request', defaultUser: true },
        { key: 'requestFailed', label: 'Request Failed', category: 'request', adminOnly: true, defaultAdmin: true },
        { key: 'requestProcessing', label: 'Processing Started', category: 'request' },
        { key: 'issueReported', label: 'Issue Reported', category: 'issue', defaultAdmin: true },
        { key: 'issueComment', label: 'Issue Comment', category: 'issue' },
        { key: 'issueResolved', label: 'Issue Resolved', category: 'issue' },
        { key: 'issueReopened', label: 'Issue Reopened', category: 'issue' },
        { key: 'test', label: 'Test', category: 'system', defaultAdmin: true, defaultUser: false },
    ],
    monitor: [
        { key: 'serviceUp', label: 'Service Recovered', category: 'status', defaultAdmin: true },
        { key: 'serviceDown', label: 'Service Down', category: 'status', defaultAdmin: true },
        { key: 'serviceDegraded', label: 'Service Degraded', category: 'status', defaultAdmin: true },
        { key: 'serviceMaintenanceStart', label: 'Maintenance Started', category: 'maintenance', defaultAdmin: true },
        { key: 'serviceMaintenanceEnd', label: 'Maintenance Ended', category: 'maintenance', defaultAdmin: true },
    ],
    uptimekuma: [
        { key: 'serviceUp', label: 'Service Recovered', category: 'status', defaultAdmin: true },
        { key: 'serviceDown', label: 'Service Down', category: 'status', defaultAdmin: true },
        { key: 'serviceDegraded', label: 'Service Degraded', category: 'status', defaultAdmin: true },
    ]
};

// Instance from backend
interface IntegrationInstance {
    id: string;
    type: string;
    displayName: string;
    config: Record<string, unknown>;
    enabled: boolean;
    createdAt: string;
    updatedAt: string | null;
}

interface ServiceSettingsGridProps {
    integrations: Record<string, IntegrationConfig>;
    savedIntegrations: Record<string, IntegrationConfig>;
    instances: IntegrationInstance[];
    savedInstances: IntegrationInstance[];
    schemas?: Record<string, IntegrationSchemaInfo>; // P4 Phase 4.4: Server schemas
    onFieldChange: (service: string, field: string, value: string) => void;
    onToggle: (service: string) => void;
    onToggleInstance?: (instanceId: string) => void;  // Toggle specific instance enabled state
    onTest: (service: string) => Promise<void>;
    onReset: (service: string) => void;
    onSave: (instanceId: string) => Promise<void>;
    onCancel: () => void;
    onDeleteInstance: (instanceId: string) => Promise<void>;
    testStates: Record<string, TestState | null>;
    saving: boolean;
    // Controlled modal state from parent
    activeModal: string | null;
    setActiveModal: (id: string | null) => void;
    newInstanceId: string | null; // For cancel-to-delete behavior
    // Custom renderers for complex services
    renderPlex: (instanceId: string) => React.ReactNode;
    renderJellyfin: (instanceId: string) => React.ReactNode;
    renderEmby: (instanceId: string) => React.ReactNode;
    renderMonitor: (instanceId: string) => React.ReactNode;
    renderUptimeKuma: (instanceId: string) => React.ReactNode;
    // Custom test handlers for complex services
    onTestPlex?: () => Promise<void>;
    // Custom save/cancel for Monitor and UptimeKuma
    onMonitorSave?: () => Promise<void>;
    onMonitorCancel?: () => void;
    onUptimeKumaSave?: () => Promise<void>;
}

const ServiceSettingsGrid: React.FC<ServiceSettingsGridProps> = ({
    integrations,
    savedIntegrations,
    instances,
    savedInstances,
    schemas,
    onFieldChange,
    onToggle,
    onToggleInstance,
    onTest,
    onReset,
    onSave,
    onCancel,
    onDeleteInstance,
    testStates,
    saving,
    activeModal,
    setActiveModal,
    newInstanceId,
    renderPlex,
    renderJellyfin,
    renderEmby,
    renderMonitor,
    renderUptimeKuma,
    onTestPlex,
    onMonitorSave,
    onMonitorCancel,
    onUptimeKumaSave
}) => {

    // Derive service definitions from schemas prop (or fallback to empty)
    const serviceDefinitions = useMemo(() => {
        if (!schemas) return [];
        return Object.entries(schemas).map(([id, schema]) => ({
            id,
            name: schema.name,
            description: schema.description,
            category: schema.category as ServiceDefinition['category'],
            icon: getIntegrationIcon(schema.icon),
            hasConnectionTest: schema.hasConnectionTest,
        }));
    }, [schemas]);

    // Check if a service is configured based on SAVED state (for card badges)
    const isSavedConfigured = (serviceId: string): boolean => {
        const config = savedIntegrations[serviceId];
        if (!config?.enabled) return false;
        // Complex services are considered configured when enabled
        if (serviceId === 'plex' || serviceId === 'monitor' || serviceId === 'uptimekuma') {
            return true;
        }
        return !!config.url;
    };

    // Handle modal close (cancel) - refetch to discard unsaved changes
    const handleModalClose = (instanceId?: string) => {
        // Get type from instances for special case handling
        const instance = instanceId ? instances.find(i => i.id === instanceId) : null;
        const type = instance?.type;

        // For monitor, use custom cancel handler
        if (type === 'monitor' && onMonitorCancel) {
            onMonitorCancel();
        } else {
            onCancel(); // Refetch integrations to discard any unsaved changes
        }
        setActiveModal(null);
    };

    // Handle modal save - save and close modal on success
    const handleModalSave = async (instanceId: string) => {
        // Get type from instances for special case handling
        const instance = instances.find(i => i.id === instanceId);
        const type = instance?.type;

        // For monitor, use custom save handler
        if (type === 'monitor' && onMonitorSave) {
            await onMonitorSave();
        }
        // For uptimekuma, use custom save handler (imports pending monitors)
        if (type === 'uptimekuma' && onUptimeKumaSave) {
            await onUptimeKumaSave();
        }
        await onSave(instanceId);  // Single-instance save
        setActiveModal(null); // Close modal after successful save
    };

    // Handle reset for modal - resets form but does NOT save or close modal
    const handleModalReset = (instanceId: string) => {
        onReset(instanceId);
        // Modal stays open so user can see the reset state
    };

    // Check if a service can be saved (required fields are filled)
    // Receives instanceId, extracts type from config._type
    const canSave = (instanceId: string): boolean => {
        const config = integrations[instanceId];
        if (!config) return false;

        // If not enabled, always can save (just disabling)
        if (!config.enabled) return true;

        // Get the integration type from stored metadata
        const type = (config as { _type?: string })._type;

        // SystemStatus: needs URL for selected backend
        if (type === 'systemstatus') {
            const sysConfig = config as { backend?: string; glances?: { url?: string }; custom?: { url?: string } };
            const backend = sysConfig.backend || 'glances';
            const backendConfig = backend === 'glances' ? sysConfig.glances : sysConfig.custom;
            return !!backendConfig?.url;
        }

        // Plex: needs url and token
        if (type === 'plex') {
            return !!(config.url && config.token);
        }

        // Monitor: always can save when enabled (no required fields)
        if (type === 'monitor') {
            return true;
        }

        // UptimeKuma: always can save when enabled
        if (type === 'uptimekuma') {
            return true;
        }

        // Glances: needs URL
        if (type === 'glances') {
            return !!config.url;
        }

        // Standard services: use schema fields from API
        const schemaFields = type ? schemas?.[type]?.configSchema?.fields : null;
        if (!schemaFields) return !!config.url;

        // Check all required fields (url is always required)
        if (!config.url) return false;

        // Check if apiKey field exists and is required
        const apiKeyField = schemaFields.find(f => f.key === 'apiKey');
        if (apiKeyField && !config.apiKey) return false;

        return true;
    };

    // Render form content based on service type and instance
    const renderFormContent = (serviceId: string, instanceId: string) => {
        // Complex services use render props with instanceId
        if (serviceId === 'plex') return renderPlex(instanceId);
        if (serviceId === 'jellyfin') return renderJellyfin(instanceId);
        if (serviceId === 'emby') return renderEmby(instanceId);
        if (serviceId === 'monitor') return renderMonitor(instanceId);
        if (serviceId === 'uptimekuma') return renderUptimeKuma(instanceId);

        // Standard services use StandardIntegrationForm with schema from API
        const schemaInfo = schemas?.[serviceId];
        if (!schemaInfo) return null;

        // Use instanceId for config lookup (state is keyed by instance ID, not type)
        const config = integrations[instanceId] || { enabled: false };

        // Build minimal serviceDef from schema (StandardIntegrationForm needs this shape)
        const serviceDef: ServiceDefinition = {
            id: serviceId,
            name: schemaInfo.name,
            description: schemaInfo.description || '',
            icon: getIntegrationIcon(schemaInfo.icon),
            category: schemaInfo.category as ServiceDefinition['category'],
            hasConnectionTest: schemaInfo.hasConnectionTest,
        };

        return (
            <StandardIntegrationForm
                service={serviceDef}
                config={config}
                onFieldChange={(field, value) => onFieldChange(instanceId, field, value)}
                serverSchema={schemaInfo.configSchema}
            />
        );
    };

    return (
        <>
            {/* Categorized Service List */}
            <div className="space-y-6">
                {CATEGORY_ORDER.map(category => {
                    // Get all service types in this category from schemas
                    const servicesInCategory = serviceDefinitions.filter(
                        s => s.category === category.key
                    );

                    if (servicesInCategory.length === 0) return null;

                    return (
                        <div key={category.key}>
                            {/* Category Header */}
                            <h3 className="text-lg font-semibold text-theme-primary mb-3 capitalize flex items-center gap-2">
                                {category.label}
                                <span className="text-sm text-theme-secondary font-normal">
                                    ({servicesInCategory.length})
                                </span>
                            </h3>

                            {/* All services use IntegrationTypeCard */}
                            <div className="space-y-3">
                                {servicesInCategory.map(serviceDef => {
                                    const typeInstances = savedInstances.filter(i => i.type === serviceDef.id);

                                    // Only show card if at least 1 instance exists for this type
                                    if (typeInstances.length === 0) return null;

                                    return (
                                        <IntegrationTypeCard
                                            key={serviceDef.id}
                                            type={serviceDef.id}
                                            name={serviceDef.name}
                                            description={serviceDef.description}
                                            icon={serviceDef.icon}
                                            instances={typeInstances}
                                            onEditInstance={(instanceId) => setActiveModal(instanceId)}
                                            onDeleteInstance={onDeleteInstance}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Docker Networking Tip - Below grid */}
            <div className="mt-6 bg-info/10 rounded-xl p-4">
                <div className="flex gap-3">
                    <AlertCircle className="text-info flex-shrink-0 mt-0.5" size={20} />
                    <div className="text-sm text-theme-primary">
                        <p className="font-medium mb-1">Docker Networking Tip</p>
                        <p className="text-theme-secondary">
                            If running in Docker, use container names or host network IPs instead of localhost.
                            Example: <code className="bg-theme-tertiary px-2 py-0.5 rounded text-info">http://plex:32400</code>
                        </p>
                    </div>
                </div>
            </div>

            {/* Service Configuration Modals - All instances (from backend) */}
            {instances.map(instance => {
                // Build serviceDef from schema or handle custom forms
                const schemaInfo = schemas?.[instance.type];

                // Custom form types (plex, monitor, uptimekuma) work without schema
                // Standard types need schema to render
                if (!schemaInfo && !hasCustomForm(instance.type)) return null;

                const supportsWebhook = WEBHOOK_SUPPORTED_TYPES.includes(instance.type);
                const isLocalMode = LOCAL_NOTIFICATION_TYPES.includes(instance.type);
                const webhookEvents = WEBHOOK_EVENTS[instance.type] || [];
                const instanceConfig = integrations[instance.id] || {};
                const webhookConfig = (instanceConfig as { webhookConfig?: NotificationConfigData }).webhookConfig || {};

                // Build serviceDef from schema for modal props
                const serviceDef: ServiceDefinition = schemaInfo ? {
                    id: instance.type,
                    name: schemaInfo.name,
                    description: schemaInfo.description || '',
                    icon: getIntegrationIcon(schemaInfo.icon),
                    category: schemaInfo.category as ServiceDefinition['category'],
                    hasConnectionTest: schemaInfo.hasConnectionTest,
                    hasWebhook: supportsWebhook,
                } : {
                    // Fallback for custom forms that may not be in schemas
                    id: instance.type,
                    name: instance.displayName,
                    description: '',
                    icon: getIntegrationIcon(undefined),
                    category: 'system' as const,
                    hasWebhook: supportsWebhook,
                };

                return (
                    <ServiceConfigModal
                        key={instance.id}
                        isOpen={activeModal === instance.id}
                        onClose={() => handleModalClose(instance.id)}
                        service={serviceDef}
                        displayName={(integrations[instance.id] as { _displayName?: string })?._displayName ?? instance.displayName}
                        onDisplayNameChange={(name) => onFieldChange(instance.id, '_displayName', name)}
                        onTest={
                            instance.type === 'monitor' ? undefined :
                                instance.type === 'plex' ? onTestPlex :
                                    () => onTest(instance.id)
                        }
                        onReset={() => handleModalReset(instance.id)}
                        onSave={() => handleModalSave(instance.id)}
                        onToggle={onToggleInstance ? () => onToggleInstance(instance.id) : undefined}
                        testState={testStates[instance.id]}
                        saving={saving}
                        isEnabled={instance.enabled}
                        canSave={canSave(instance.id)}
                        webhookContent={supportsWebhook ? (
                            <IntegrationNotificationsTab
                                mode={isLocalMode ? "local" : "webhook"}
                                instanceId={instance.id}
                                instanceType={instance.type}
                                config={webhookConfig}
                                events={webhookEvents}
                                webhookBaseUrl={window.location.origin}
                                onConfigChange={(config) => {
                                    // Store webhook config in integration state as object (not string)
                                    // The backend handles JSON serialization of the config column
                                    onFieldChange(instance.id, 'webhookConfig', config as unknown as string);
                                }}
                                onGenerateToken={() => {
                                    // Generate a new token (fallback for non-HTTPS dev environments)
                                    const token = crypto.randomUUID?.() ??
                                        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                                            const r = Math.random() * 16 | 0;
                                            const v = c === 'x' ? r : (r & 0x3 | 0x8);
                                            return v.toString(16);
                                        });
                                    // Calculate default events from event definitions
                                    const adminDefaults = webhookEvents.filter(e => e.defaultAdmin).map(e => e.key);
                                    const userDefaults = webhookEvents.filter(e => e.defaultUser).map(e => e.key);
                                    const newConfig = {
                                        ...webhookConfig,
                                        webhookToken: token,
                                        webhookEnabled: true,
                                        adminEvents: adminDefaults,
                                        userEvents: userDefaults
                                    };
                                    onFieldChange(instance.id, 'webhookConfig', newConfig as unknown as string);
                                }}
                                onCopyUrl={(url: string) => {
                                    // Try modern clipboard API first (only works in HTTPS/localhost)
                                    if (navigator.clipboard?.writeText) {
                                        navigator.clipboard.writeText(url)
                                            .catch(() => window.prompt('Copy this URL (Ctrl+C):', url));
                                    } else {
                                        // Fallback: show prompt with selectable text
                                        window.prompt('Copy this URL (Ctrl+C):', url);
                                    }
                                }}
                            />
                        ) : null}
                    >
                        {renderFormContent(instance.type, instance.id)}
                    </ServiceConfigModal>
                );
            })}
        </>
    );
};

export default ServiceSettingsGrid;

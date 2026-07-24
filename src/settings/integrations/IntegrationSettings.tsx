/**
 * IntegrationSettings - Thin Orchestrator
 * 
 * Renders the integration management UI with:
 * - Header with "Add Integration" dropdown
 * - ServiceSettingsGrid for the card grid and modals
 * 
 * P4 Phase 4.4: Fetches plugin schemas for dynamic form generation.
 * All state and logic is managed by useIntegrationSettings hook.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, ChevronDown, Server } from 'lucide-react';
import ServiceSettingsGrid from './components/ServiceSettingsGrid';
import { LoadingSpinner } from '@/shared/ui';
import { SettingsPage, SettingsSection } from '../../shared/ui/settings';
import { Button, ActionSelect } from '../../shared/ui';
import PlexForm from '../../integrations/plex/PlexForm';
import JellyfinForm from '../../integrations/jellyfin/JellyfinForm';
import EmbyForm from '../../integrations/emby/EmbyForm';
import { MonitorForm } from '../../integrations/monitor';
import { UptimeKumaForm } from '../../integrations/uptime-kuma';
import { getIntegrationIcon } from '../../integrations/_core/iconMapping';
import { useIntegrationSettings } from './hooks/useIntegrationSettings';
import { useWalkthrough } from '../../features/walkthrough/useWalkthrough';
import { useIntegrationSchemas } from '../../api/hooks';
import { useAdminNotificationConfig } from '../../api/hooks/useSettings';
import { useRealtimeSSE, type LibrarySyncProgressEvent } from '@/features/realtime/useRealtimeSSE';
import api from '../../api/client';
import logger from '../../utils/logger';
import type { PlexConfig } from './types';

/** Media integration types that support library sync */
const MEDIA_SYNC_TYPES = ['plex', 'jellyfin', 'emby'];

/** Sync status from library sync service */
interface SyncStatus {
    syncStatus: 'idle' | 'syncing' | 'error' | 'completed';
    totalItems: number;
    indexedItems: number;
    lastSyncCompleted: string | null;
    errorMessage: string | null;
    phase?: 'fetching' | 'indexing';
    statusMessage?: string;
}


const IntegrationSettings: React.FC = () => {
    const {
        // State
        integrations,
        savedIntegrations,
        instances,
        savedInstances,
        loading,
        saving,
        testStates,

        // Modal state
        activeModal,
        setActiveModal,
        newInstanceId,

        // Form refs
        monitorFormRef,
        uptimeKumaFormRef,

        // Plex state
        plexAuthenticating,
        plexLoadingServers,

        // Handlers
        handleFieldChange,
        handleToggle,
        handleSave,
        handleTest,
        handleReset,
        fetchIntegrations,

        // Instance handlers
        handleAddIntegration,
        handleDeleteInstance,
        handleToggleInstance,

        // Plex handlers
        handlePlexLogin,
        handlePlexServerChange,
        fetchPlexServers,

        // Monitor handlers
        handleMonitorFormReady,
        handleMonitorSave,
        handleMonitorCancel,
        monitorDirty,
        handleMonitorDirtyChange,

        // UptimeKuma handlers
        handleUptimeKumaFormReady,
        handleUptimeKumaSave,
    } = useIntegrationSettings();

    // Walkthrough emit for custom-event advancement
    const walkthrough = useWalkthrough();

    // Fetch plugin schemas for dynamic form generation (P4 Phase 4.4)
    const { data: schemas } = useIntegrationSchemas();

    // Fetch admin notification config for webhookBaseUrl
    const { data: adminNotifConfig } = useAdminNotificationConfig();
    const webhookBaseUrl = adminNotifConfig?.webhookBaseUrl;

    // Transform schemas to service list for dropdown (A–Z by display name)
    const serviceList = useMemo(() => {
        if (!schemas) return [];
        return Object.entries(schemas)
            .map(([id, schema]) => ({
                id,
                name: schema.name,
                icon: getIntegrationIcon(schema.icon),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }, [schemas]);

    const [integrationSearch, setIntegrationSearch] = useState('');
    const filteredServiceList = useMemo(() => {
        const q = integrationSearch.trim().toLowerCase();
        if (!q) return serviceList;
        return serviceList.filter((service) => service.name.toLowerCase().includes(q));
    }, [serviceList, integrationSearch]);

    // Media sync status for library sync toggle (Plex, Jellyfin, Emby)
    const [mediaSyncStatus, setMediaSyncStatus] = useState<Record<string, SyncStatus>>({});

    // Fetch sync status for a media integration
    const fetchMediaSyncStatus = useCallback(async (instanceId: string): Promise<SyncStatus | null> => {
        try {
            const data = await api.get<SyncStatus>(
                `/api/media/sync/status/${instanceId}`,
                { headers: { 'X-Widget-Type': 'media-library-sync' } }
            );
            setMediaSyncStatus(prev => ({ ...prev, [instanceId]: data }));
            return data;
        } catch (error) {
            // Silently fail - status will just not be shown
            logger.debug('[IntegrationSettings] Failed to fetch sync status:', error);
        }
        return null;
    }, []);

    // SSE listener for real-time sync progress updates
    const { onLibrarySyncProgress, onSettingsInvalidate } = useRealtimeSSE();

    useEffect(() => {
        // Listen for real-time progress updates
        const unsubscribeProgress = onLibrarySyncProgress((event: LibrarySyncProgressEvent) => {
            setMediaSyncStatus(prev => ({
                ...prev,
                [event.integrationId]: {
                    ...prev[event.integrationId],
                    syncStatus: 'syncing',
                    indexedItems: event.indexed,
                    totalItems: event.total,
                    errorMessage: null,
                    phase: event.phase,
                    statusMessage: event.statusMessage
                } as SyncStatus
            }));
        });

        // Listen for sync complete/error via settings invalidation
        const unsubscribeInvalidate = onSettingsInvalidate((event) => {
            if (event.entity === 'media-search-sync') {
                // Sync state changed - refetch status for all media integrations
                instances
                    .filter(inst => MEDIA_SYNC_TYPES.includes(inst.type))
                    .forEach(inst => fetchMediaSyncStatus(inst.id));
            }
        });

        return () => {
            unsubscribeProgress();
            unsubscribeInvalidate();
        };
    }, [onLibrarySyncProgress, onSettingsInvalidate, instances, fetchMediaSyncStatus]);

    // Handle Sync Now button click for any media integration
    const handleMediaSyncNow = useCallback(async (instanceId: string) => {
        // Optimistic update - immediately show syncing state
        setMediaSyncStatus(prev => ({
            ...prev,
            [instanceId]: {
                ...prev[instanceId],
                syncStatus: 'syncing',
                indexedItems: 0,
                totalItems: prev[instanceId]?.totalItems || 0,
                errorMessage: null
            } as SyncStatus
        }));

        try {
            await api.post(
                `/api/media/sync/start/${instanceId}`,
                {},
                { headers: { 'X-Widget-Type': 'media-library-sync' } }
            );
            // SSE will automatically receive progress updates
        } catch (error) {
            logger.error('[IntegrationSettings] Failed to start sync:', error);
            // Revert optimistic update on error
            setMediaSyncStatus(prev => ({
                ...prev,
                [instanceId]: {
                    ...prev[instanceId],
                    syncStatus: 'error',
                    errorMessage: 'Failed to start sync'
                } as SyncStatus
            }));
        }
    }, []);

    // Fetch sync status when media modal opens
    useEffect(() => {
        if (activeModal && activeModal !== newInstanceId) {
            const instance = instances.find((inst) => inst.id === activeModal);
            if (instance && MEDIA_SYNC_TYPES.includes(instance.type)) {
                queueMicrotask(() => fetchMediaSyncStatus(activeModal));
            }
        }
    }, [activeModal, instances, newInstanceId, fetchMediaSyncStatus]);

    // Render Plex form content for modal
    const renderPlexForm = (instanceId: string) => {
        const config = (integrations[instanceId] || { enabled: true }) as PlexConfig;
        const isNewIntegration = instanceId === newInstanceId;
        const syncStatus = mediaSyncStatus[instanceId] || null;

        return (
            <PlexForm
                instanceId={instanceId}
                config={config}
                onFieldChange={(field, value) => handleFieldChange(instanceId, field, value)}
                onPlexLogin={handlePlexLogin}
                onServerChange={handlePlexServerChange}
                onRefreshServers={() => config.token && fetchPlexServers(config.token)}
                authenticating={plexAuthenticating}
                loadingServers={plexLoadingServers}
                isNewIntegration={isNewIntegration}
                syncStatus={syncStatus}
                onSyncNow={() => handleMediaSyncNow(instanceId)}
            />
        );
    };

    // Render Jellyfin form content for modal
    const renderJellyfinForm = (instanceId: string) => {
        const config = (integrations[instanceId] || { enabled: true }) as Record<string, unknown>;
        const isNewIntegration = instanceId === newInstanceId;
        const syncStatus = mediaSyncStatus[instanceId] || null;

        return (
            <JellyfinForm
                instanceId={instanceId}
                config={config}
                onFieldChange={(field, value) => handleFieldChange(instanceId, field, value)}
                isNewIntegration={isNewIntegration}
                syncStatus={syncStatus}
                onSyncNow={() => handleMediaSyncNow(instanceId)}
            />
        );
    };

    // Render Emby form content for modal
    const renderEmbyForm = (instanceId: string) => {
        const config = (integrations[instanceId] || { enabled: true }) as Record<string, unknown>;
        const isNewIntegration = instanceId === newInstanceId;
        const syncStatus = mediaSyncStatus[instanceId] || null;

        return (
            <EmbyForm
                instanceId={instanceId}
                config={config}
                onFieldChange={(field, value) => handleFieldChange(instanceId, field, value)}
                isNewIntegration={isNewIntegration}
                syncStatus={syncStatus}
                onSyncNow={() => handleMediaSyncNow(instanceId)}
            />
        );
    };

    // Render Monitor form content for modal
    const renderMonitorForm = (instanceId: string) => (
        <MonitorForm
            ref={monitorFormRef}
            instanceId={instanceId}
            integrations={integrations}
            onReady={handleMonitorFormReady}
            onDirtyChange={handleMonitorDirtyChange}
        />
    );

    // Render Uptime Kuma form content for modal
    const renderUptimeKumaForm = (instanceId: string) => (
        <UptimeKumaForm
            ref={uptimeKumaFormRef}
            instanceId={instanceId}
            integrations={integrations}
            onFieldChange={handleFieldChange}
            onReady={handleUptimeKumaFormReady}
        />
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="lg" message="Loading integrations..." />
            </div>
        );
    }

    return (
        <SettingsPage
            title="Service Settings"
            description="Configure connections to your homelab services"
            headerAction={
                <ActionSelect
                    closeOnScroll={false}
                    onOpenChange={(open) => {
                        if (!open) setIntegrationSearch('');
                    }}
                >
                    <ActionSelect.Trigger>
                        <Button
                            variant="primary"
                            size="md"
                            textSize="sm"
                            data-walkthrough="add-integration-button"
                        >
                            <Plus size={16} />
                            Add Integration
                            <ChevronDown size={14} />
                        </Button>
                    </ActionSelect.Trigger>
                    <ActionSelect.Content
                        align="end"
                        sideOffset={8}
                        className="!w-56 p-1 integration-type-dropdown"
                        data-walkthrough="integration-type-dropdown"
                    >
                        <ActionSelect.Search
                            value={integrationSearch}
                            onChange={setIntegrationSearch}
                            placeholder="Search integrations..."
                        />
                        <ActionSelect.Items maxHeight={320}>
                            {filteredServiceList.length === 0 ? (
                                <ActionSelect.Empty>
                                    {integrationSearch
                                        ? 'No integrations match your search'
                                        : 'No integrations available'}
                                </ActionSelect.Empty>
                            ) : (
                                filteredServiceList.map((service) => {
                                    const Icon = service.icon;
                                    return (
                                        <ActionSelect.Item
                                            key={service.id}
                                            onClick={() => {
                                                handleAddIntegration(service.id, service.name);
                                                walkthrough?.emit('integration-type-selected');
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Icon size={16} className="text-theme-secondary flex-shrink-0" />
                                                <span>{service.name}</span>
                                            </div>
                                        </ActionSelect.Item>
                                    );
                                })
                            )}
                        </ActionSelect.Items>
                    </ActionSelect.Content>
                </ActionSelect>
            }
        >
            <SettingsSection title="Configured Services" icon={Server}>
                <ServiceSettingsGrid
                    integrations={integrations}
                    savedIntegrations={savedIntegrations}
                    instances={instances}
                    savedInstances={savedInstances}
                    schemas={schemas}
                    onFieldChange={handleFieldChange}
                    onToggle={handleToggle}
                    onTest={handleTest}
                    onReset={handleReset}
                    onSave={handleSave}
                    onCancel={fetchIntegrations}
                    onDeleteInstance={handleDeleteInstance}
                    onToggleInstance={handleToggleInstance}
                    testStates={testStates}
                    saving={saving}
                    activeModal={activeModal}
                    setActiveModal={setActiveModal}
                    newInstanceId={newInstanceId}
                    renderPlex={renderPlexForm}
                    renderJellyfin={renderJellyfinForm}
                    renderEmby={renderEmbyForm}
                    renderMonitor={renderMonitorForm}
                    renderUptimeKuma={renderUptimeKumaForm}
                    onMonitorSave={handleMonitorSave}
                    onMonitorCancel={handleMonitorCancel}
                    onUptimeKumaSave={handleUptimeKumaSave}
                    monitorHasChanges={monitorDirty}
                    webhookBaseUrl={webhookBaseUrl}
                />
            </SettingsSection>
        </SettingsPage>
    );
};

export default IntegrationSettings;


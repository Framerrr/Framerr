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

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, ChevronDown, Server } from 'lucide-react';
import ServiceSettingsGrid from './components/ServiceSettingsGrid';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { SettingsPage, SettingsSection } from '../../shared/ui/settings';
import { Button } from '../../shared/ui';
import PlexForm from '../../integrations/plex/PlexForm';
import JellyfinForm from '../../integrations/jellyfin/JellyfinForm';
import EmbyForm from '../../integrations/emby/EmbyForm';
import { MonitorForm } from '../../integrations/monitor';
import { UptimeKumaForm } from '../../integrations/uptime-kuma';
import { getIntegrationIcon } from '../../integrations/_core/iconMapping';
import { useIntegrationSettings } from './hooks/useIntegrationSettings';
import { useIntegrationSchemas } from '../../api/hooks';
import { useRealtimeSSE, type LibrarySyncProgressEvent } from '../../hooks/useRealtimeSSE';
import { widgetFetch } from '../../utils/widgetFetch';
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
        addDropdownOpen,
        setAddDropdownOpen,
        addDropdownRef,

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
        handlePlexTest,
        fetchPlexServers,

        // Monitor handlers
        handleMonitorFormReady,
        handleMonitorSave,
        handleMonitorCancel,

        // UptimeKuma handlers
        handleUptimeKumaFormReady,
        handleUptimeKumaSave,
        handleUptimeKumaCancel
    } = useIntegrationSettings();

    // Fetch plugin schemas for dynamic form generation (P4 Phase 4.4)
    const { data: schemas } = useIntegrationSchemas();

    // Transform schemas to service list for dropdown
    const serviceList = useMemo(() => {
        if (!schemas) return [];
        return Object.entries(schemas).map(([id, schema]) => ({
            id,
            name: schema.name,
            icon: getIntegrationIcon(schema.icon),
        }));
    }, [schemas]);

    // Media sync status for library sync toggle (Plex, Jellyfin, Emby)
    const [mediaSyncStatus, setMediaSyncStatus] = useState<Record<string, SyncStatus>>({});

    // Fetch sync status for a media integration
    const fetchMediaSyncStatus = useCallback(async (instanceId: string): Promise<SyncStatus | null> => {
        try {
            const response = await widgetFetch(`/api/media/sync/status/${instanceId}`, 'media-library-sync');
            if (response.ok) {
                const data = await response.json() as SyncStatus;
                setMediaSyncStatus(prev => ({ ...prev, [instanceId]: data }));
                return data;
            }
        } catch (error) {
            // Silently fail - status will just not be shown
            console.debug('[IntegrationSettings] Failed to fetch sync status:', error);
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
                    errorMessage: null
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
            await widgetFetch(`/api/media/sync/start/${instanceId}`, 'media-library-sync', { method: 'POST' });
            // SSE will automatically receive progress updates
        } catch (error) {
            console.error('[IntegrationSettings] Failed to start sync:', error);
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
                fetchMediaSyncStatus(activeModal);
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
                <div className="relative" ref={addDropdownRef}>
                    <Button
                        onClick={() => setAddDropdownOpen(!addDropdownOpen)}
                        variant="primary"
                        size="md"
                        textSize="sm"
                    >
                        <Plus size={16} />
                        Add Integration
                        <ChevronDown size={14} className={`transition-transform ${addDropdownOpen ? 'rotate-180' : ''}`} />
                    </Button>

                    {addDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 py-1 rounded-lg border border-theme bg-theme-secondary shadow-deep z-50 animate-in fade-in zoom-in-95 duration-100">
                            {serviceList.map(service => {
                                const Icon = service.icon;
                                return (
                                    <button
                                        key={service.id}
                                        onClick={() => handleAddIntegration(service.id, service.name)}
                                        className="w-full px-4 py-2.5 text-left text-sm text-theme-primary hover:bg-theme-hover flex items-center gap-3"
                                    >
                                        <Icon size={16} className="text-theme-secondary" />
                                        {service.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
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
                    onTestPlex={handlePlexTest}
                    onMonitorSave={handleMonitorSave}
                    onMonitorCancel={handleMonitorCancel}
                    onUptimeKumaSave={handleUptimeKumaSave}
                />
            </SettingsSection>
        </SettingsPage>
    );
};

export default IntegrationSettings;


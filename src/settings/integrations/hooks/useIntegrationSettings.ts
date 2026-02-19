/**
 * useIntegrationSettings Hook
 * 
 * Manages all state and logic for integration settings:
 * - Fetching and saving integration instances
 * - Connection testing
 * - Plex OAuth flow and server management
 * - Adding/deleting integration instances
 * 
 * P2 Migration: Hybrid pattern
 * - Server state: useIntegrations for list, mutations for CRUD
 * - Local state: Form edits, modals, Plex OAuth, test states
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { integrationsApi, plexApi } from '@/api';
import { ApiError } from '@/api/errors';
import { usePlexOAuth, PlexUser } from '../../../hooks/usePlexOAuth';
import {
    useIntegrations,
    useCreateIntegration,
    useUpdateIntegration,
    useDeleteIntegration,
} from '../../../api/hooks/useIntegrations';
import logger from '../../../utils/logger';
import { useNotifications } from '../../../context/NotificationContext';
import type {
    IntegrationInstance,
    IntegrationsState,
    TestState,
    IntegrationConfig,
    PlexConfig
} from '../types';
import type { MonitorFormRef } from '../../../integrations/monitor';
import type { UptimeKumaFormRef } from '../../../integrations/uptime-kuma';

export interface UseIntegrationSettingsReturn {
    // State
    integrations: IntegrationsState;
    savedIntegrations: IntegrationsState;
    instances: IntegrationInstance[];
    savedInstances: IntegrationInstance[];
    loading: boolean;
    saving: boolean;
    testStates: Record<string, TestState | null>;

    // Modal state
    activeModal: string | null;
    setActiveModal: (id: string | null) => void;
    newInstanceId: string | null;

    // Form refs
    monitorFormRef: React.RefObject<MonitorFormRef | null>;
    uptimeKumaFormRef: React.RefObject<UptimeKumaFormRef | null>;

    // Plex state
    plexAuthenticating: boolean;
    plexLoadingServers: boolean;

    // Handlers
    handleFieldChange: (service: string, field: string, value: string | boolean) => void;
    handleToggle: (service: string) => void;
    handleSave: (instanceId: string) => Promise<void>;
    handleTest: (instanceId: string) => Promise<void>;
    handleReset: (instanceId: string) => void;
    fetchIntegrations: () => Promise<void>;

    // Instance handlers
    handleAddIntegration: (type: string, name?: string) => void;
    handleDeleteInstance: (instanceId: string) => Promise<void>;
    handleToggleInstance: (instanceId: string) => void;

    // Plex handlers
    handlePlexLogin: () => Promise<void>;
    handlePlexServerChange: (machineId: string) => void;
    fetchPlexServers: (token: string) => Promise<void>;

    // Monitor handlers
    handleMonitorFormReady: () => void;
    handleMonitorSave: () => Promise<void>;
    handleMonitorCancel: () => void;

    // UptimeKuma handlers
    handleUptimeKumaFormReady: () => void;
    handleUptimeKumaSave: () => Promise<void>;
    handleUptimeKumaCancel: () => void;
}

export function useIntegrationSettings(): UseIntegrationSettingsReturn {
    const { success: showSuccess, error: showError } = useNotifications();

    // ========================================================================
    // Server State (React Query)
    // ========================================================================

    const {
        data: fetchedInstances = [],
        isLoading: queryLoading,
        refetch: refetchIntegrations,
    } = useIntegrations();

    const createMutation = useCreateIntegration();
    const updateMutation = useUpdateIntegration();
    const deleteMutation = useDeleteIntegration();

    // ========================================================================
    // Local State (Form edits, UI)
    // ========================================================================

    // Config state keyed by INSTANCE ID (not type)
    const [integrations, setIntegrations] = useState<IntegrationsState>({});
    // Separate state for card badges - only updates on save/fetch, not live edits
    const [savedIntegrations, setSavedIntegrations] = useState<IntegrationsState>({});
    // Local instances (includes ephemeral new instances)
    const [localInstances, setLocalInstances] = useState<IntegrationInstance[]>([]);
    const [savedInstances, setSavedInstances] = useState<IntegrationInstance[]>([]);

    const [saving, setSaving] = useState<boolean>(false);
    const [testStates, setTestStates] = useState<Record<string, TestState | null>>({});
    const [initialized, setInitialized] = useState<boolean>(false);

    // Plex-specific state
    const [plexLoadingServers, setPlexLoadingServers] = useState(false);

    // Ref to capture current activeModal for async callbacks (synced after activeModal declaration)
    const activeModalRef = useRef<string | null>(null);

    // Monitor form ref for modal save/cancel
    const monitorFormRef = useRef<MonitorFormRef>(null);
    // UptimeKuma form ref for modal save/cancel
    const uptimeKumaFormRef = useRef<UptimeKumaFormRef>(null);
    // Force re-render when forms mount
    const [, setMonitorFormReady] = useState(0);
    const [, setUptimeKumaFormReady] = useState(0);



    // Track newly created instance that hasn't been saved yet (for cancel-to-delete)
    const [newInstanceId, setNewInstanceId] = useState<string | null>(null);
    const [activeModal, setActiveModal] = useState<string | null>(null);

    // Sync activeModal to ref for async callbacks in usePlexOAuth
    useEffect(() => {
        activeModalRef.current = activeModal;
    }, [activeModal]);

    // Derived loading state
    const loading = queryLoading && !initialized;

    // Merge server instances with local new instances
    const instances = useMemo(() => {
        // Server instances + any local ephemeral instances (temp IDs)
        const ephemeralInstances = localInstances.filter(i => i.id.startsWith('new-'));
        // Use fetched data for saved instances, plus any ephemeral
        const serverInstances = (fetchedInstances as IntegrationInstance[]) || [];
        return [...serverInstances, ...ephemeralInstances];
    }, [fetchedInstances, localInstances]);

    // ========================================================================
    // Sync from Server Data
    // ========================================================================

    // Initialize/sync form state when server data loads
    useEffect(() => {
        if (!fetchedInstances || (fetchedInstances as IntegrationInstance[]).length === 0 && initialized) return;

        const serverInstances = (fetchedInstances as IntegrationInstance[]) || [];

        // Store saved instances
        setSavedInstances(serverInstances);

        // Convert to keyed object format - keyed by INSTANCE ID (not type)
        const fetchedConfigs: IntegrationsState = {};

        for (const instance of serverInstances) {
            fetchedConfigs[instance.id] = {
                ...instance.config,
                enabled: instance.enabled,
                _instanceId: instance.id,
                _displayName: instance.displayName,
                _type: instance.type
            } as IntegrationConfig;
        }

        // Only reset form state if not editing (preserve ephemeral instances)
        setIntegrations(prev => {
            const ephemeralEntries = Object.entries(prev).filter(([k]) => k.startsWith('new-'));
            return { ...fetchedConfigs, ...Object.fromEntries(ephemeralEntries) };
        });
        setSavedIntegrations(fetchedConfigs);
        setInitialized(true);
    }, [fetchedInstances, initialized]);



    // ========================================================================
    // Basic Handlers
    // ========================================================================

    const handleToggle = useCallback((service: string): void => {
        setIntegrations(prev => ({
            ...prev,
            [service]: {
                ...prev[service],
                enabled: !prev[service].enabled
            }
        }));
    }, []);

    const handleFieldChange = useCallback((service: string, field: string, value: string | boolean): void => {
        setIntegrations(prev => ({
            ...prev,
            [service]: {
                ...prev[service],
                [field]: value
            }
        }));
    }, []);

    /**
     * Compares two config objects (excluding transient metadata fields).
     * Returns true if configs are equal (no changes).
     */
    const configsAreEqual = useCallback((
        current: IntegrationConfig | undefined,
        saved: IntegrationConfig | undefined
    ): boolean => {
        if (!current && !saved) return true;
        if (!current || !saved) return false;

        // Extract config without metadata fields for comparison
        const extractConfig = (cfg: IntegrationConfig) => {
            const { _instanceId, _displayName, _type, ...rest } = cfg as IntegrationConfig & {
                _instanceId?: string; _displayName?: string; _type?: string
            };
            return { ...rest, _displayName }; // Keep displayName in comparison
        };

        const currentClean = extractConfig(current);
        const savedClean = extractConfig(saved);

        return JSON.stringify(currentClean) === JSON.stringify(savedClean);
    }, []);

    /**
     * Save a single integration instance.
     * Includes change detection - skips save if config unchanged.
     */
    const handleSave = useCallback(async (instanceId: string): Promise<void> => {
        const config = integrations[instanceId];
        if (!config || typeof config !== 'object') {
            logger.warn(`[useIntegrationSettings] No config found for instanceId=${instanceId}`);
            return;
        }

        // Change detection: compare current vs saved config
        const savedConfig = savedIntegrations[instanceId];
        if (configsAreEqual(config, savedConfig)) {
            logger.info(`[useIntegrationSettings] No changes detected for instanceId=${instanceId}, skipping save`);
            return; // No changes - skip API call
        }

        setSaving(true);
        try {
            const { _instanceId, _displayName, _type, enabled, ...configWithoutMeta } = config as IntegrationConfig & {
                _instanceId?: string; _displayName?: string; _type?: string
            };

            const isNewInstance = instanceId.startsWith('new-');

            if (isNewInstance) {
                await createMutation.mutateAsync({
                    type: _type || '',
                    name: _displayName || (_type ? _type.charAt(0).toUpperCase() + _type.slice(1) : 'Integration'),
                    config: configWithoutMeta,
                    enabled
                });
                // Remove from ephemeral instances after successful create
                setLocalInstances(prev => prev.filter(i => i.id !== instanceId));
                setNewInstanceId(null);
            } else {
                await updateMutation.mutateAsync({
                    id: instanceId,
                    data: {
                        name: _displayName,
                        config: configWithoutMeta,
                        enabled
                    }
                });
            }

            showSuccess('Settings Saved', 'Integration settings saved successfully');
            window.dispatchEvent(new CustomEvent('integrationsUpdated'));

            logger.info(`[useIntegrationSettings] Saved single integration: instanceId=${instanceId}`);
        } catch (error) {
            const apiError = error as ApiError;
            logger.error('Error saving integration:', error);
            showError('Save Failed', apiError.message || 'Failed to save integration');
        } finally {
            setSaving(false);
        }
    }, [integrations, savedIntegrations, configsAreEqual, createMutation, updateMutation, showSuccess, showError]);

    const handleTest = useCallback(async (instanceId: string): Promise<void> => {
        const config = integrations[instanceId];
        if (!config) {
            setTestStates(prev => ({
                ...prev,
                [instanceId]: { loading: false, success: false, message: '✗ No config found' }
            }));
            return;
        }

        const type = (config as { _type?: string })._type;
        if (!type) {
            setTestStates(prev => ({
                ...prev,
                [instanceId]: { loading: false, success: false, message: '✗ Unknown integration type' }
            }));
            return;
        }

        setTestStates(prev => ({ ...prev, [instanceId]: { loading: true } }));
        try {
            const { _instanceId, _displayName, _type, enabled, ...configWithoutMeta } = config as IntegrationConfig & { _instanceId?: string; _displayName?: string; _type?: string };

            const result = await integrationsApi.testByConfig(type, configWithoutMeta, instanceId.startsWith('new-') ? undefined : instanceId);

            setTestStates(prev => ({
                ...prev,
                [instanceId]: {
                    loading: false,
                    success: result.success,
                    message: result.success
                        ? `✓ ${result.message || 'Connection successful'}`
                        : `✗ ${result.error}`
                }
            }));

            setTimeout(() => {
                setTestStates(prev => ({ ...prev, [instanceId]: null }));
            }, 5000);
        } catch (error) {
            const apiError = error as ApiError;
            setTestStates(prev => ({
                ...prev,
                [instanceId]: {
                    loading: false,
                    success: false,
                    message: `✗ ${apiError.message || 'Connection failed'}`
                }
            }));
        }
    }, [integrations]);

    const handleReset = useCallback((instanceId: string): void => {
        const savedConfig = savedIntegrations[instanceId];
        if (savedConfig) {
            setIntegrations(prev => ({
                ...prev,
                [instanceId]: { ...savedConfig }
            }));
        } else {
            const config = integrations[instanceId];
            const type = (config as { _type?: string })._type;
            setIntegrations(prev => ({
                ...prev,
                [instanceId]: {
                    enabled: true,
                    url: '',
                    apiKey: '',
                    username: '',
                    password: '',
                    _instanceId: instanceId,
                    _displayName: config?._displayName || 'Integration',
                    _type: type
                }
            }));
        }
    }, [savedIntegrations, integrations]);

    // Wrapper to match expected API
    const fetchIntegrations = useCallback(async (): Promise<void> => {
        await refetchIntegrations();
    }, [refetchIntegrations]);

    // ========================================================================
    // Instance Management
    // ========================================================================

    const handleAddIntegration = useCallback((type: string, name?: string): void => {

        const displayName = name || type.charAt(0).toUpperCase() + type.slice(1);

        const tempId = `new-${type}-${Date.now()}`;
        const now = new Date().toISOString();
        const newInstance: IntegrationInstance = {
            id: tempId,
            type,
            displayName,
            config: {},
            enabled: true,
            createdAt: now,
            updatedAt: now
        };

        setLocalInstances(prev => [...prev, newInstance]);
        setIntegrations(prev => ({
            ...prev,
            [tempId]: {
                enabled: true,
                _instanceId: tempId,
                _displayName: displayName,
                _type: type
            }
        }));

        setNewInstanceId(tempId);
        setActiveModal(tempId);
    }, []);

    const handleDeleteInstance = useCallback(async (instanceId: string): Promise<void> => {
        try {
            await deleteMutation.mutateAsync(instanceId);
            showSuccess('Integration Deleted', 'Integration instance removed successfully');
            window.dispatchEvent(new CustomEvent('integrationsUpdated'));
        } catch (error) {
            const apiError = error as ApiError;
            showError('Delete Failed', apiError.message || 'Failed to delete integration');
        }
    }, [deleteMutation, showSuccess, showError]);

    const handleToggleInstance = useCallback((instanceId: string): void => {
        const instance = instances.find(i => i.id === instanceId);
        if (!instance) return;

        const newEnabled = !instance.enabled;

        setLocalInstances(prev => prev.map(i =>
            i.id === instanceId ? { ...i, enabled: newEnabled } : i
        ));

        setIntegrations(prev => ({
            ...prev,
            [instanceId]: {
                ...prev[instanceId],
                enabled: newEnabled
            }
        }));
    }, [instances]);

    // ========================================================================
    // Plex Handlers
    // ========================================================================

    const fetchPlexServers = useCallback(async (token: string): Promise<void> => {
        if (!activeModal) return;
        const instanceId = activeModal;

        setPlexLoadingServers(true);
        try {
            const servers = await plexApi.getResources(token) || [];

            setIntegrations(prev => {
                const currentConfig = (prev[instanceId] as PlexConfig) || { enabled: true };
                let newPlex: PlexConfig = { ...currentConfig, servers, token };

                if (!currentConfig.machineId && servers.length > 0) {
                    const ownedServer = servers.find((s: { owned: boolean }) => s.owned) || servers[0];
                    newPlex = {
                        ...newPlex,
                        machineId: ownedServer.machineId,
                        url: ownedServer.connections?.find((c: { local: boolean }) => c.local)?.uri || ownedServer.connections?.[0]?.uri || ''
                    };
                }

                return { ...prev, [instanceId]: newPlex };
            });
        } catch (error) {
            logger.error('[Plex] Failed to fetch servers:', (error as Error).message);
        } finally {
            setPlexLoadingServers(false);
        }
    }, [activeModal]);

    // Plex OAuth hook - uses ref to get current activeModal in callbacks
    const handlePlexAuthSuccess = useCallback(async (token: string, user: PlexUser): Promise<void> => {
        const currentInstanceId = activeModalRef.current;
        if (!currentInstanceId) return;

        setIntegrations(prev => ({
            ...prev,
            [currentInstanceId]: { ...prev[currentInstanceId], token }
        }));

        await fetchPlexServers(token);
        showSuccess('Plex Connected', `Connected as ${user.username ?? 'Plex User'}`);
        window.dispatchEvent(new CustomEvent('linkedAccountsUpdated'));
    }, [fetchPlexServers, showSuccess]);

    const handlePlexAuthError = useCallback((error: string): void => {
        showError('Plex Auth Failed', error);
    }, [showError]);

    const { startAuth: handlePlexLogin, isAuthenticating: plexAuthenticating } = usePlexOAuth({
        mode: 'popup',
        onSuccess: handlePlexAuthSuccess,
        onError: handlePlexAuthError
    });

    const handlePlexServerChange = useCallback((machineId: string): void => {
        if (!activeModal) return;

        const currentConfig = integrations[activeModal] as PlexConfig || {};
        const servers = currentConfig.servers || [];
        const server = servers.find((s: { machineId: string }) => s.machineId === machineId);
        const url = server?.connections?.find((c) => c.local === true)?.uri || server?.connections?.[0]?.uri || '';

        setIntegrations(prev => ({
            ...prev,
            [activeModal]: { ...prev[activeModal], machineId, url }
        }));
    }, [activeModal, integrations]);

    // ========================================================================
    // Form Ready Callbacks
    // ========================================================================

    const handleMonitorFormReady = useCallback(() => {
        setMonitorFormReady(prev => prev + 1);
    }, []);

    const handleUptimeKumaFormReady = useCallback(() => {
        setUptimeKumaFormReady(prev => prev + 1);
    }, []);

    // ========================================================================
    // Monitor/UptimeKuma Handlers
    // ========================================================================

    const handleMonitorSave = useCallback(async (): Promise<void> => {
        await monitorFormRef.current?.saveAll();
    }, []);

    const handleMonitorCancel = useCallback((): void => {
        monitorFormRef.current?.resetAll();
    }, []);

    const handleUptimeKumaSave = useCallback(async (): Promise<void> => {
        await uptimeKumaFormRef.current?.saveAll();
    }, []);

    const handleUptimeKumaCancel = useCallback((): void => {
        uptimeKumaFormRef.current?.resetAll();
    }, []);

    // ========================================================================
    // Return
    // ========================================================================

    return {
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

        // UptimeKuma handlers
        handleUptimeKumaFormReady,
        handleUptimeKumaSave,
        handleUptimeKumaCancel
    };
}

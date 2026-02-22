/**
 * useMonitorForm - State and logic for MonitorForm component
 * Extracted from MonitorForm.tsx during Phase 1.5.2 refactor
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useIntegrationSchemas } from '../../../api/hooks/useIntegrations';
import {
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Monitor, DEFAULT_MONITOR, MaintenanceSchedule, TestState, IntegrationConfig } from '../types';
import logger from '../../../utils/logger';

interface UseMonitorFormProps {
    instanceId: string;
    integrations: Record<string, IntegrationConfig>;
}

interface UseMonitorFormReturn {
    // State
    monitors: Monitor[];
    newMonitors: Monitor[];
    expandedId: string | null;
    loading: boolean;
    error: string | null;
    testStates: Record<string, TestState>;
    modifiedIds: Set<string>;
    orderModified: boolean;
    importDropdownOpen: boolean;
    importTriggerRef: React.RefObject<HTMLButtonElement | null>;
    sensors: ReturnType<typeof useSensors>;
    /** Whether the monitor form has unsaved changes */
    hasChanges: boolean;

    // Actions
    setExpandedId: (id: string | null) => void;
    setImportDropdownOpen: (open: boolean) => void;
    handleAddMonitor: () => void;
    handleImport: (integration: { id: string; name: string; icon: string; url: string; type: string }) => void;
    handleMonitorChange: (id: string, field: keyof Monitor, value: string | number | boolean | MaintenanceSchedule | null) => void;
    handleDeleteMonitor: (id: string) => Promise<void>;
    handleTestMonitor: (id: string) => Promise<void>;
    handleCancelNew: (id: string) => void;
    handleDragEnd: (event: DragEndEvent) => void;
    saveAll: () => Promise<void>;
    resetAll: () => void;

    // Computed
    allMonitors: Monitor[];
    getConfiguredIntegrations: () => Array<{ id: string; name: string; icon: string; url: string; type: string }>;
    importedIntegrationIds: Set<string | null | undefined>;
}

export function useMonitorForm({ instanceId, integrations }: UseMonitorFormProps): UseMonitorFormReturn {
    const [monitors, setMonitors] = useState<Monitor[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [newMonitors, setNewMonitors] = useState<Monitor[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testStates, setTestStates] = useState<Record<string, TestState>>({});
    const [modifiedIds, setModifiedIds] = useState<Set<string>>(new Set());
    const [orderModified, setOrderModified] = useState(false);
    const [displayOrder, setDisplayOrder] = useState<string[]>([]);
    const [importDropdownOpen, setImportDropdownOpen] = useState(false);
    const importTriggerRef = useRef<HTMLButtonElement>(null);

    // Drag and drop sensors for monitor reordering
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 150,
                tolerance: 5
            }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Fetch monitors for THIS instance on mount
    const fetchMonitors = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Filter by integration instance ID
            const response = await fetch(`/api/service-monitors?instanceId=${encodeURIComponent(instanceId)}`, {
                headers: { 'X-Framerr-Client': '1' }
            });
            if (!response.ok) throw new Error('Failed to fetch monitors');
            const data = await response.json();
            // Map backend field names to frontend Monitor interface
            const fetchedMonitors: Monitor[] = (data.monitors || []).map((m: Record<string, unknown>) => ({
                ...m,
                icon: m.iconName || m.icon || 'Globe',
                check_interval_seconds: m.intervalSeconds || m.check_interval_seconds || 60,
                timeout_seconds: m.timeoutSeconds || m.timeout_seconds || 10,
                retries_before_down: m.retries || m.retries_before_down || 3,
                degraded_threshold_ms: m.degradedThresholdMs || m.degraded_threshold_ms || 2000,
                expected_status_codes: Array.isArray(m.expectedStatusCodes)
                    ? m.expectedStatusCodes.join(',')
                    : (m.expectedStatusCodes || m.expected_status_codes || '200-299'),
                maintenance_mode: m.maintenance || m.maintenance_mode || false,
                maintenanceSchedule: m.maintenanceSchedule || null,
                integrationInstanceId: (m.integrationInstanceId || m.integration_instance_id || null) as string | null,
                sourceIntegrationId: (m.sourceIntegrationId || m.source_integration_id || null) as string | null,
            } as Monitor));

            // Filter to only first-party monitors (exclude UK imports)
            const firstPartyMonitors = fetchedMonitors.filter(m => m.uptimeKumaId == null);

            // Fetch status for each monitor
            const monitorsWithStatus = await Promise.all(
                firstPartyMonitors.map(async (monitor) => {
                    try {
                        const statusRes = await fetch(`/api/service-monitors/${monitor.id}/status`, {
                            headers: { 'X-Framerr-Client': '1' }
                        });
                        if (statusRes.ok) {
                            const statusData = await statusRes.json();
                            return {
                                ...monitor,
                                status: statusData.status,
                                response_time_ms: statusData.responseTimeMs
                            };
                        }
                    } catch {
                        // Ignore status fetch errors
                    }
                    return monitor;
                })
            );

            setMonitors(monitorsWithStatus);
            setDisplayOrder(monitorsWithStatus.map(m => m.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load monitors');
        } finally {
            setLoading(false);
        }
    }, [instanceId]);

    useEffect(() => {
        fetchMonitors();
    }, [fetchMonitors]);

    // Get configured integrations for import dropdown
    const { data: schemas } = useIntegrationSchemas();

    const getConfiguredIntegrations = useCallback(() => {
        const configured: Array<{ id: string; name: string; icon: string; url: string; type: string }> = [];

        // Types to exclude from import list (self-referential monitoring integrations)
        const excludeTypes = ['servicemonitoring', 'uptime-kuma', 'monitor', 'uptimekuma'];

        Object.entries(integrations).forEach(([intInstanceId, intConfig]) => {
            const type = intConfig._type;
            const displayName = intConfig._displayName;

            if (intConfig.enabled && intConfig.url && type && !excludeTypes.includes(type)) {
                // Look up icon and name from plugin schemas (no hardcoded maps)
                const schema = schemas?.[type];
                configured.push({
                    id: intInstanceId,
                    name: displayName || schema?.name || type,
                    icon: schema?.icon || 'Globe',
                    url: intConfig.url,
                    type: type
                });
            }
        });
        return configured;
    }, [integrations, schemas]);

    // Integration instance IDs that already have monitors (for import dedup)
    const importedIntegrationIds = new Set(
        [...monitors, ...newMonitors]
            .map(m => m.sourceIntegrationId)
            .filter(Boolean)
    );

    // Handle adding new monitor
    const handleAddMonitor = useCallback(() => {
        const tempId = `new-${Date.now()}`;
        const newMon: Monitor = {
            ...DEFAULT_MONITOR,
            id: tempId
        };
        setNewMonitors(prev => [...prev, newMon]);
        setDisplayOrder(prev => [tempId, ...prev]);
        setExpandedId(tempId);
    }, []);

    // Handle import from integration
    const handleImport = useCallback((integration: { id: string; name: string; icon: string; url: string; type: string }) => {
        const tempId = `new-${Date.now()}`;

        // For Plex, append /identity to the URL (Plex's health check endpoint)
        let monitorUrl = integration.url;
        if (integration.type === 'plex') {
            monitorUrl = integration.url.replace(/\/+$/, '') + '/identity';
        }

        const newMon: Monitor = {
            ...DEFAULT_MONITOR,
            id: tempId,
            name: integration.name,
            url: monitorUrl,
            icon: integration.icon,
            integrationInstanceId: integration.id,
            sourceIntegrationId: integration.id
        };
        setNewMonitors(prev => [...prev, newMon]);
        setDisplayOrder(prev => [tempId, ...prev]);
        setExpandedId(tempId);
    }, []);

    // Handle monitor field change
    const handleMonitorChange = useCallback((id: string, field: keyof Monitor, value: string | number | boolean | MaintenanceSchedule | null) => {
        const newMonIndex = newMonitors.findIndex(m => m.id === id);
        if (newMonIndex !== -1) {
            setNewMonitors(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
        } else {
            setMonitors(prev => prev.map(m =>
                m.id === id ? { ...m, [field]: value } : m
            ));
            setModifiedIds(prev => new Set(prev).add(id));
        }
    }, [newMonitors]);

    // Handle delete monitor (confirmation handled by ConfirmButton in UI)
    const handleDeleteMonitor = useCallback(async (id: string) => {
        try {
            const response = await fetch(`/api/service-monitors/${id}`, {
                method: 'DELETE',
                headers: { 'X-Framerr-Client': '1' }
            });
            if (!response.ok) throw new Error('Failed to delete monitor');
            setMonitors(prev => prev.filter(m => m.id !== id));
            setDisplayOrder(prev => prev.filter(oid => oid !== id));
            if (expandedId === id) setExpandedId(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        }
    }, [expandedId]);

    // Handle test monitor
    const handleTestMonitor = useCallback(async (id: string) => {
        const newMon = newMonitors.find(m => m.id === id);
        const isNew = !!newMon;
        const monitor = isNew ? newMon : monitors.find(m => m.id === id);
        if (!monitor) return;

        setTestStates(prev => ({ ...prev, [id]: { loading: true } }));

        try {
            const response = await fetch('/api/service-monitors/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Framerr-Client': '1'
                },
                body: JSON.stringify({
                    url: monitor.url,
                    host: monitor.host,
                    port: monitor.port,
                    type: monitor.type,
                    timeout_seconds: monitor.timeout_seconds,
                    expected_status_codes: monitor.expected_status_codes
                })
            });

            const result = await response.json();
            setTestStates(prev => ({
                ...prev,
                [id]: {
                    loading: false,
                    success: result.success,
                    message: result.success
                        ? `Connected in ${result.response_time_ms}ms`
                        : result.error || 'Connection failed'
                }
            }));

            // Update monitor status in UI on successful test
            if (result.success) {
                const newStatus = result.response_time_ms > (monitor.degraded_threshold_ms || 2000) ? 'degraded' : 'up';
                if (isNew) {
                    setNewMonitors(prev => prev.map(m =>
                        m.id === id ? { ...m, status: newStatus, response_time_ms: result.response_time_ms } : m
                    ));
                } else {
                    setMonitors(prev => prev.map(m =>
                        m.id === id ? { ...m, status: newStatus, response_time_ms: result.response_time_ms } : m
                    ));
                }
            } else if (isNew) {
                setNewMonitors(prev => prev.map(m => m.id === id ? { ...m, status: 'down' } : m));
            } else {
                setMonitors(prev => prev.map(m =>
                    m.id === id ? { ...m, status: 'down' } : m
                ));
            }
        } catch (err) {
            setTestStates(prev => ({
                ...prev,
                [id]: {
                    loading: false,
                    success: false,
                    message: err instanceof Error ? err.message : 'Test failed'
                }
            }));
            if (isNew) {
                setNewMonitors(prev => prev.map(m => m.id === id ? { ...m, status: 'down' } : m));
            } else {
                setMonitors(prev => prev.map(m =>
                    m.id === id ? { ...m, status: 'down' } : m
                ));
            }
        }
    }, [newMonitors, monitors]);

    const handleCancelNew = useCallback((id: string) => {
        setNewMonitors(prev => prev.filter(m => m.id !== id));
        setDisplayOrder(prev => prev.filter(oid => oid !== id));
        if (expandedId === id) {
            setExpandedId(null);
        }
    }, [expandedId]);

    // Handle drag end for monitor reordering (works across new + existing)
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setDisplayOrder(prev => {
            const oldIndex = prev.indexOf(active.id as string);
            const newIndex = prev.indexOf(over.id as string);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
        setOrderModified(true);
    }, []);

    // Save all pending changes: new monitors + modified monitors
    const saveAll = useCallback(async () => {
        // 1. Save new monitors that have content (discard empty ones)
        const monitorsToSave = newMonitors.filter(m => m.name?.trim());
        const savedMonitors: Monitor[] = [];

        // Build a map from temp ID to real ID for order tracking
        const tempToRealId = new Map<string, string>();
        for (const newMon of monitorsToSave) {
            try {
                const payload = {
                    name: newMon.name,
                    url: newMon.url,
                    port: newMon.port,
                    type: newMon.type,
                    iconName: newMon.icon,
                    enabled: newMon.enabled,
                    intervalSeconds: newMon.check_interval_seconds,
                    timeoutSeconds: newMon.timeout_seconds,
                    retries: newMon.retries_before_down,
                    degradedThresholdMs: newMon.degraded_threshold_ms,
                    expectedStatusCodes: newMon.expected_status_codes,
                    maintenanceSchedule: newMon.maintenanceSchedule,
                    integrationInstanceId: instanceId,
                    sourceIntegrationId: newMon.sourceIntegrationId || null
                };

                const response = await fetch('/api/service-monitors', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Framerr-Client': '1'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || 'Failed to save monitor');
                }

                const saved = await response.json();
                const savedMon = saved.monitor || saved;
                savedMonitors.push(savedMon);
                tempToRealId.set(newMon.id, savedMon.id);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save');
                throw err;
            }
        }

        // Build the combined ordered list using displayOrder (preserving drag order) with real IDs
        if (savedMonitors.length > 0) {
            // Build lookup for all monitor data
            const monitorMap = new Map<string, Monitor>();
            for (const m of newMonitors) monitorMap.set(m.id, m);
            for (const m of monitors) monitorMap.set(m.id, m);
            for (const m of savedMonitors) {
                // Find which temp ID maps to this saved monitor
                for (const [tempId, realId] of tempToRealId) {
                    if (realId === m.id) {
                        monitorMap.delete(tempId);
                        monitorMap.set(realId, m);
                    }
                }
            }

            // Build ordered list from displayOrder, replacing temp IDs with real IDs
            const allSaved: Monitor[] = [];
            const newDisplayOrder: string[] = [];
            for (const id of displayOrder) {
                const realId = tempToRealId.get(id) || id;
                // Skip unsaved new monitors (empty name)
                if (id.startsWith('new-') && !tempToRealId.has(id)) continue;
                const m = monitorMap.get(realId) || monitorMap.get(id);
                if (m) {
                    allSaved.push({ ...m, id: realId });
                    newDisplayOrder.push(realId);
                }
            }
            setMonitors(allSaved);
            setDisplayOrder(newDisplayOrder);
        }
        setNewMonitors([]);

        // 2. Save modified existing monitors
        if (modifiedIds.size > 0) {
            const modifiedMonitors = monitors.filter(m => modifiedIds.has(m.id));
            for (const monitor of modifiedMonitors) {
                try {
                    const payload = {
                        name: monitor.name,
                        url: monitor.url,
                        port: monitor.port,
                        type: monitor.type,
                        iconName: monitor.icon,
                        enabled: monitor.enabled,
                        intervalSeconds: monitor.check_interval_seconds,
                        timeoutSeconds: monitor.timeout_seconds,
                        retries: monitor.retries_before_down,
                        degradedThresholdMs: monitor.degraded_threshold_ms,
                        expectedStatusCodes: monitor.expected_status_codes,
                        maintenanceSchedule: monitor.maintenanceSchedule
                    };

                    const response = await fetch(`/api/service-monitors/${monitor.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Framerr-Client': '1'
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error || 'Failed to update monitor');
                    }
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to update');
                    throw err;
                }
            }
            setModifiedIds(new Set());
        }

        // 3. Save monitor order (always save after creating new monitors to preserve position)
        if (orderModified || savedMonitors.length > 0) {
            try {
                // Always use displayOrder — it tracks the user's drag-reordered sequence.
                // If we just saved new monitors, remap temp IDs to real IDs.
                const finalOrderedIds = savedMonitors.length > 0
                    ? displayOrder
                        .filter(id => !id.startsWith('new-') || tempToRealId.has(id))
                        .map(id => tempToRealId.get(id) || id)
                    : displayOrder.filter(id => !id.startsWith('new-'));

                await fetch('/api/service-monitors/reorder', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Framerr-Client': '1'
                    },
                    body: JSON.stringify({ orderedIds: finalOrderedIds })
                });
                setOrderModified(false);
                logger.debug('Monitor order saved', { orderedIds: finalOrderedIds });
            } catch (err) {
                logger.error('Failed to save monitor order:', err);
            }
        }

        setExpandedId(null);
        setTestStates({});
    }, [newMonitors, monitors, modifiedIds, orderModified, instanceId, displayOrder]);

    // Reset all pending changes (discard new monitor, refetch from backend)
    const resetAll = useCallback(() => {
        setNewMonitors([]);
        setExpandedId(null);
        setTestStates({});
        setModifiedIds(new Set());
        setOrderModified(false);
        setDisplayOrder([]);
        fetchMonitors();
    }, [fetchMonitors]);

    // Compute allMonitors sorted by displayOrder
    const allMonitors = useMemo(() => {
        const monitorMap = new Map<string, Monitor>();
        for (const m of newMonitors) monitorMap.set(m.id, m);
        for (const m of monitors) monitorMap.set(m.id, m);
        // Sort by displayOrder, append any not yet in displayOrder
        const ordered: Monitor[] = [];
        for (const id of displayOrder) {
            const m = monitorMap.get(id);
            if (m) {
                ordered.push(m);
                monitorMap.delete(id);
            }
        }
        // Append any remaining (shouldn't happen, but safety)
        for (const m of monitorMap.values()) {
            ordered.push(m);
        }
        return ordered;
    }, [newMonitors, monitors, displayOrder]);

    // Computed dirty state: true when any monitors are new, edited, or reordered
    const hasChanges = newMonitors.length > 0 || modifiedIds.size > 0 || orderModified;

    return {
        // State
        monitors,
        newMonitors,
        expandedId,
        loading,
        error,
        testStates,
        modifiedIds,
        orderModified,
        importDropdownOpen,
        importTriggerRef,
        sensors,
        hasChanges,

        // Actions
        setExpandedId,
        setImportDropdownOpen,
        handleAddMonitor,
        handleImport,
        handleMonitorChange,
        handleDeleteMonitor,
        handleTestMonitor,
        handleCancelNew,
        handleDragEnd,
        saveAll,
        resetAll,

        // Computed
        allMonitors,
        getConfiguredIntegrations,
        importedIntegrationIds,
    };
}

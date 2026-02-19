/**
 * UptimeKumaForm - Form for Uptime Kuma integration
 * 
 * REST API pattern with monitor selection:
 * - User enters URL + API Key
 * - Test fetches available monitors
 * - User selects which monitors to include
 * - selectedMonitorIds stored in config
 * 
 * Moved to features/integrations/uptime-kuma/ during Phase 1.5.3 refactor.
 */

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { Link2, AlertCircle, Loader, Check, Server, RefreshCw, Download, ChevronDown } from 'lucide-react';
import { Button } from '../../shared/ui';
import { Popover } from '../../shared/ui';
import StandardIntegrationForm from '../_core/StandardIntegrationForm';
import { getIntegrationIcon } from '../_core/iconMapping';
import { IntegrationConfig, ServiceDefinition } from '../_core/definitions';
import { useIntegrationSchemas } from '../../api/hooks/useIntegrations';
import type { UKMonitor, UptimeKumaFormRef, UptimeKumaFormProps } from './types';

const UptimeKumaForm = forwardRef<UptimeKumaFormRef, UptimeKumaFormProps>((
    { instanceId, integrations, onFieldChange, onReady },
    ref
) => {
    // Get credentials from parent state (dirty state)
    const config = (integrations[instanceId] || {}) as IntegrationConfig;
    const formUrl = (config.url as string) || '';
    const formApiKey = (config.apiKey as string) || '';
    // selectedMonitorIds are now names (strings) since /metrics doesn't expose numeric IDs
    const selectedMonitorIdsStr = (config.selectedMonitorIds as string) || '[]';
    const selectedMonitorIds: string[] = (() => {
        try {
            return JSON.parse(selectedMonitorIdsStr);
        } catch {
            return [];
        }
    })();

    // UK-specific state
    const [availableMonitors, setAvailableMonitors] = useState<UKMonitor[]>([]);
    const [fetching, setFetching] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const [addDropdownOpen, setAddDropdownOpen] = useState(false);
    const addTriggerRef = useRef<HTMLButtonElement>(null);

    // Get schema from API for StandardIntegrationForm
    const { data: schemas } = useIntegrationSchemas();
    const schemaInfo = schemas?.['uptimekuma'];

    // Build serviceDef from schema for StandardIntegrationForm
    const serviceDef: ServiceDefinition | null = schemaInfo ? {
        id: 'uptimekuma',
        name: schemaInfo.name,
        description: schemaInfo.description || '',
        icon: getIntegrationIcon(schemaInfo.icon),
        category: schemaInfo.category as ServiceDefinition['category'],
        hasConnectionTest: schemaInfo.hasConnectionTest,
    } : null;

    // Fetch monitors from UK using credentials
    const fetchMonitors = useCallback(async () => {
        if (!formUrl || !formApiKey) {
            setFetchError('URL and API key are required');
            return;
        }

        setFetching(true);
        setFetchError(null);

        try {
            // Test connection and fetch monitors in one call
            const response = await fetch('/api/integrations/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Framerr-Client': '1' },
                body: JSON.stringify({
                    service: 'uptimekuma',
                    config: { url: formUrl, apiKey: formApiKey },
                    instanceId: instanceId || undefined
                })
            });

            const data = await response.json();
            if (!data.success) {
                setFetchError(data.error || 'Failed to connect');
                return;
            }

            // Now fetch the actual monitor list via a direct call
            // (test just verifies connection, we need the list)
            const listResponse = await fetch('/api/integrations/uptimekuma/monitors-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Framerr-Client': '1' },
                body: JSON.stringify({ url: formUrl, apiKey: formApiKey, instanceId: instanceId || undefined })
            });

            if (!listResponse.ok) {
                // Fallback: use the test result if it worked
                setHasFetched(true);
                return;
            }

            const listData = await listResponse.json();
            setAvailableMonitors(listData.monitors || []);
            setHasFetched(true);
        } catch (err) {
            setFetchError(err instanceof Error ? err.message : 'Connection failed');
        } finally {
            setFetching(false);
        }
    }, [formUrl, formApiKey]);

    // Toggle monitor selection (uses name as ID)
    const toggleMonitorSelection = (monitorId: string) => {
        const current = selectedMonitorIds;
        const updated = current.includes(monitorId)
            ? current.filter(id => id !== monitorId)
            : [...current, monitorId];
        onFieldChange(instanceId, 'selectedMonitorIds', JSON.stringify(updated));
    };

    // Select all monitors
    const selectAllMonitors = () => {
        const allIds = availableMonitors.map(m => m.id);
        onFieldChange(instanceId, 'selectedMonitorIds', JSON.stringify(allIds));
    };

    // Clear all selections
    const clearAllMonitors = () => {
        onFieldChange(instanceId, 'selectedMonitorIds', '[]');
    };

    // Expose save/reset methods to parent via ref
    useImperativeHandle(ref, () => ({
        saveAll: async () => {
            // selectedMonitorIds already stored in config via onFieldChange
            // Nothing extra to do on save
        },
        resetAll: () => {
            setAvailableMonitors([]);
            setFetchError(null);
            setHasFetched(false);
        }
    }), []);

    // Auto-fetch monitors ONLY on initial mount when editing existing integration
    // (credentials already saved). Do NOT refetch on keystroke changes.
    useEffect(() => {
        // Only fetch once on mount if credentials exist (editing existing integration)
        const hasExistingCredentials = formUrl && formApiKey;
        if (hasExistingCredentials && !hasFetched) {
            fetchMonitors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps = only run on mount

    // Notify parent we're ready
    useEffect(() => {
        onReady?.();
    }, [onReady]);

    return (
        <div className="space-y-6 p-4">
            {/* Standard credential fields (url, apiKey) */}
            {serviceDef && (
                <StandardIntegrationForm
                    service={serviceDef}
                    config={config}
                    onFieldChange={(field, value) => onFieldChange(instanceId, field, value as string)}
                    serverSchema={schemaInfo?.configSchema}
                />
            )}

            {/* Fetch monitors button */}
            <div className="flex items-center gap-3">
                <Button
                    onClick={fetchMonitors}
                    disabled={fetching || !formUrl || !formApiKey}
                    icon={fetching ? Loader : RefreshCw}
                    variant="secondary"
                    size="sm"
                >
                    {fetching ? 'Fetching...' : hasFetched ? 'Refresh Monitors' : 'Fetch Monitors'}
                </Button>

                {hasFetched && availableMonitors.length > 0 && (
                    <span className="text-sm text-success flex items-center gap-1">
                        <Check size={14} />
                        {availableMonitors.length} monitors available
                    </span>
                )}
            </div>

            {fetchError && (
                <div className="flex items-center gap-2 text-error text-sm">
                    <AlertCircle size={16} />
                    {fetchError}
                </div>
            )}

            {/* Monitor selection - Dropdown + Selected list with delete */}
            {availableMonitors.length > 0 && (
                <div className="space-y-4">
                    {/* Dropdown to add monitors */}
                    <div>
                        <label className="block text-sm font-medium text-theme-secondary mb-2">
                            Add Monitors
                        </label>
                        <div className="relative">
                            <Popover open={addDropdownOpen} onOpenChange={setAddDropdownOpen} closeOnScroll={false}>
                                <Popover.Trigger asChild>
                                    <button
                                        ref={addTriggerRef}
                                        disabled={availableMonitors.filter(m => !selectedMonitorIds.includes(m.id)).length === 0}
                                        className={`
                                            w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm
                                            border border-theme transition-colors
                                            ${availableMonitors.filter(m => !selectedMonitorIds.includes(m.id)).length === 0
                                                ? 'bg-theme-tertiary text-theme-tertiary cursor-not-allowed'
                                                : 'bg-theme-secondary text-theme-primary hover:bg-theme-hover cursor-pointer'
                                            }
                                        `}
                                    >
                                        <span className="flex items-center gap-2">
                                            <Download size={16} />
                                            {availableMonitors.filter(m => !selectedMonitorIds.includes(m.id)).length === 0
                                                ? 'All monitors added'
                                                : 'Select a monitor to add...'
                                            }
                                        </span>
                                        <ChevronDown size={16} className={`transition-transform ${addDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                </Popover.Trigger>
                                <Popover.Content align="start" sideOffset={4} className="p-0 min-w-[300px]">
                                    <div
                                        className="max-h-64 overflow-y-scroll overscroll-contain"
                                    >
                                        {availableMonitors
                                            .filter(m => !selectedMonitorIds.includes(m.id))
                                            .map((monitor, index) => (
                                                <button
                                                    key={`uk-monitor-${monitor.id}-${index}`}
                                                    onClick={() => {
                                                        onFieldChange(instanceId, 'selectedMonitorIds', JSON.stringify([...selectedMonitorIds, monitor.id]));
                                                        setAddDropdownOpen(false);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-theme-hover transition-colors text-left"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
                                                        <Server size={16} className="text-theme-secondary" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-theme-primary truncate">
                                                            {monitor.name}
                                                        </p>
                                                        <p className="text-xs text-theme-tertiary truncate">
                                                            {monitor.type} • {monitor.url || '—'}
                                                        </p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${monitor.active ? 'bg-success/20 text-success' : 'bg-theme-tertiary/30 text-theme-tertiary'}`}>
                                                        {monitor.active ? 'Active' : 'Paused'}
                                                    </span>
                                                </button>
                                            ))}
                                    </div>
                                </Popover.Content>
                            </Popover>
                        </div>
                    </div>

                    {/* Selected monitors list */}
                    {selectedMonitorIds.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-theme-secondary">
                                    Selected Monitors ({selectedMonitorIds.length})
                                </label>
                                <button
                                    onClick={clearAllMonitors}
                                    className="text-xs text-theme-tertiary hover:text-error transition-colors"
                                >
                                    Remove All
                                </button>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {selectedMonitorIds.map(id => {
                                    const monitor = availableMonitors.find(m => m.id === id);
                                    if (!monitor) return null;
                                    return (
                                        <div
                                            key={`uk-selected-${monitor.id}`}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-theme-secondary/30 border border-theme group"
                                        >
                                            <Server size={16} className="text-theme-secondary flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm text-theme-primary">{monitor.name}</span>
                                                <p className="text-xs text-theme-tertiary truncate">
                                                    {monitor.type} • {monitor.url || '—'}
                                                </p>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${monitor.active ? 'bg-success/20 text-success' : 'bg-theme-tertiary/30 text-theme-tertiary'
                                                }`}>
                                                {monitor.active ? 'Active' : 'Paused'}
                                            </span>
                                            <button
                                                onClick={() => toggleMonitorSelection(monitor.id)}
                                                className="p-1.5 rounded-lg text-theme-tertiary hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Remove monitor"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-theme-tertiary">
                        Selected monitors will be displayed in widgets using this integration.
                    </p>
                </div>
            )}

            {/* Empty state */}
            {hasFetched && availableMonitors.length === 0 && !fetchError && (
                <div className="text-center py-6 text-theme-tertiary">
                    <Server size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No monitors found in Uptime Kuma</p>
                    <p className="text-xs mt-1">Create monitors in Uptime Kuma first</p>
                </div>
            )}

            {/* Instructions */}
            {!hasFetched && (
                <div className="p-4 bg-theme-secondary/30 rounded-xl border border-theme">
                    <h5 className="text-sm font-medium text-theme-primary mb-2 flex items-center gap-2">
                        <Link2 size={16} />
                        Setup Instructions
                    </h5>
                    <ol className="text-xs text-theme-secondary space-y-1 list-decimal list-inside">
                        <li>Open Uptime Kuma Settings → API Keys</li>
                        <li>Generate a new API Key</li>
                        <li>Enter your Uptime Kuma URL and API Key above</li>
                        <li>Click "Fetch Monitors" to load available monitors</li>
                        <li>Select which monitors to display in Framerr</li>
                    </ol>
                </div>
            )}
        </div>
    );
});

UptimeKumaForm.displayName = 'UptimeKumaForm';

export default UptimeKumaForm;

/**
 * DiskConfigPanel — Combined disk configuration panel
 *
 * Renders:
 * 1. Disk Display mode buttons (Collapsed / Individual)
 * 2. Disk Selection dropdown populated from live SSE data
 *
 * Returns null for integrations that don't provide disk data, hiding both sections entirely
 * (including labels) since this is rendered as a component-type option.
 *
 * Receives config/updateConfig from the WidgetConfigModal component-type option.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIntegrationSSE } from '../../../shared/widgets';
import MultiSelectDropdown from '../../../shared/ui/MultiSelectDropdown/MultiSelectDropdown';
import type { StatusData } from '../types';

interface DiskConfigPanelProps {
    config: Record<string, unknown>;
    updateConfig: (key: string, value: unknown) => void;
}

const DiskConfigPanel: React.FC<DiskConfigPanelProps> = ({ config, updateConfig }) => {
    const integrationId = config.integrationId as string | undefined;
    const integrationType = integrationId?.split('-')[0] || '';
    const hasDiskIntegration = !!integrationId;

    const [diskList, setDiskList] = useState<{ id: string; name: string }[]>([]);
    const diskListRef = useRef(diskList);

    // Stable callback for SSE data
    const handleData = useCallback((data: StatusData) => {
        if (Array.isArray(data.disks) && data.disks.length > 0) {
            const newList = data.disks.map((d) => ({
                id: d.id,
                name: d.name,
            }));
            // Only update if changed
            if (JSON.stringify(diskListRef.current) !== JSON.stringify(newList)) {
                diskListRef.current = newList;
                setDiskList(newList);
            }
        }
    }, []);

    // Subscribe to SSE to get available disks
    useIntegrationSSE<StatusData>({
        integrationType: hasDiskIntegration ? integrationType : '',
        integrationId: hasDiskIntegration ? integrationId : undefined,
        enabled: hasDiskIntegration,
        onData: handleData,
    });

    // Sync disk list to config so MetricLayoutEditor can read it
    useEffect(() => {
        if (diskList.length === 0) return;
        const existing = config._diskList as { id: string; name: string }[] | undefined;
        if (JSON.stringify(existing) !== JSON.stringify(diskList)) {
            updateConfig('_diskList', diskList);
        }
    }, [diskList, config._diskList, updateConfig]);

    // Don't render if no disk data available from any integration
    if (!hasDiskIntegration || diskList.length === 0) {
        return null;
    }

    const diskCollapsed = (config.diskCollapsed as string) || 'collapsed';

    const selectedIds = config.diskSelection as string[] | undefined;
    const effectiveSelected = selectedIds && selectedIds.length > 0
        ? selectedIds
        : diskList.map((d) => d.id);

    const options = diskList.map((d) => ({
        id: d.id,
        label: d.name,
    }));

    return (
        <div className="space-y-3">
            {/* Disk Display Mode */}
            <div className="space-y-1.5">
                <div className="text-sm text-theme-secondary">Disk Display</div>
                <div className="flex gap-1 p-0.5 rounded-lg bg-theme-tertiary">
                    {[
                        { value: 'collapsed', label: 'Collapsed' },
                        { value: 'individual', label: 'Individual' },
                    ].map((choice) => (
                        <button
                            key={choice.value}
                            onClick={() => updateConfig('diskCollapsed', choice.value)}
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${diskCollapsed === choice.value
                                ? 'bg-accent text-white shadow-sm'
                                : 'text-theme-secondary hover:text-theme-primary'
                                }`}
                        >
                            {choice.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Disk Selection */}
            <div className="space-y-2">
                <div className="text-sm text-theme-secondary">Disk Selection</div>
                {options.length === 0 ? (
                    <div className="text-xs text-theme-tertiary italic py-1">
                        Waiting for disk data...
                    </div>
                ) : (
                    <MultiSelectDropdown
                        options={options}
                        selectedIds={effectiveSelected}
                        onChange={(ids) => {
                            // If all are selected, clear selection (means "all")
                            if (ids.length === diskList.length) {
                                updateConfig('diskSelection', undefined);
                            } else {
                                updateConfig('diskSelection', ids);
                            }
                        }}
                        size="sm"
                        placeholder="Select disks..."
                        showBulkActions={diskList.length > 3}
                        minSelections={1}
                        allSelectedText="All disks"
                        emptyText="No disks"
                        fullWidth
                        closeOnScroll={false}
                    />
                )}
            </div>
        </div>
    );
};

export default DiskConfigPanel;

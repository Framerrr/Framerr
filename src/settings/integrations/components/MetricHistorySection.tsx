/**
 * MetricHistorySection - Per-integration metric history controls
 * 
 * Renders inside the integration settings modal for system-status types.
 * Shows toggle, source mode selector (Auto/Internal/External), and retention slider.
 * Only visible when the global metric history feature is enabled.
 * 
 * Uses dirty state — changes are local until parent calls save() via ref.
 */

import React, { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Activity, Loader2, Globe, HardDrive, Zap } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '../../../shared/ui/Switch/Switch';
import {
    useMetricHistoryConfig,
    useUpdateMetricHistoryConfig,
    type MetricHistoryMode
} from '../../../api/hooks/useMetricHistoryConfig';
import { queryKeys } from '../../../api/queryKeys';
import { Slider } from '../../../shared/ui/Slider';
import useRealtimeSSE from '../../../hooks/useRealtimeSSE';

interface MetricHistorySectionProps {
    integrationId: string;
}

/** Imperative handle exposed via ref */
export interface MetricHistorySectionHandle {
    /** Commit pending changes to the server. No-op if nothing changed. */
    save: () => Promise<void>;
}

const MODE_OPTIONS: {
    value: MetricHistoryMode;
    label: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
        {
            value: 'auto',
            label: 'Auto',
            description: 'Use external if available, fall back to internal',
            icon: Zap,
        },
        {
            value: 'internal',
            label: 'Internal',
            description: 'Record data locally only',
            icon: HardDrive,
        },
        {
            value: 'external',
            label: 'External',
            description: 'Use external source only (disabled if unavailable)',
            icon: Globe,
        },
    ];

const MetricHistorySection = forwardRef<MetricHistorySectionHandle, MetricHistorySectionProps>(
    ({ integrationId }, ref) => {
        const { data, isLoading } = useMetricHistoryConfig(integrationId);
        const updateConfig = useUpdateMetricHistoryConfig();
        const queryClient = useQueryClient();
        const { onSettingsInvalidate } = useRealtimeSSE();

        // Local dirty state — initialized from server data, committed on save
        const [localMode, setLocalMode] = useState<MetricHistoryMode | null>(null);
        const [localRetentionDays, setLocalRetentionDays] = useState<number | null>(null);
        const [isDirty, setIsDirty] = useState(false);

        // Sync local state when server data loads (or when SSE refreshes it)
        useEffect(() => {
            if (data?.config && !isDirty) {
                setLocalMode(data.config.mode);
                setLocalRetentionDays(data.config.retentionDays);
            }
        }, [data?.config, isDirty]);

        // SSE: Re-fetch when global metric history toggle changes
        useEffect(() => {
            const unsubscribe = onSettingsInvalidate((event) => {
                if (event.entity === 'metric-history') {
                    setIsDirty(false); // Reset dirty so server data takes precedence
                    queryClient.invalidateQueries({ queryKey: queryKeys.metricHistory.integration(integrationId) });
                }
            });
            return unsubscribe;
        }, [onSettingsInvalidate, queryClient, integrationId]);

        // Imperative save handle — parent calls this on modal Save
        const save = useCallback(async () => {
            if (!isDirty || localMode === null || localRetentionDays === null) return;

            await updateConfig.mutateAsync({
                integrationId,
                config: {
                    mode: localMode,
                    retentionDays: localRetentionDays,
                },
            });
            setIsDirty(false);
        }, [isDirty, localMode, localRetentionDays, integrationId, updateConfig]);

        useImperativeHandle(ref, () => ({ save }), [save]);

        // ---------- Local state updaters ----------
        const handleToggle = (enabled: boolean) => {
            setLocalMode(enabled ? 'auto' : 'off');
            setIsDirty(true);
        };

        const handleModeChange = (mode: MetricHistoryMode) => {
            setLocalMode(mode);
            setIsDirty(true);
        };

        const handleRetentionChange = (days: number) => {
            setLocalRetentionDays(days);
            setIsDirty(true);
        };

        // ---------- Render ----------

        // Don't render if global feature is disabled or loading
        if (isLoading) {
            return (
                <div className="mt-4 pt-4 border-t border-theme">
                    <div className="flex items-center gap-2 text-theme-tertiary">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="text-xs">Loading metric history config...</span>
                    </div>
                </div>
            );
        }

        if (!data?.globalEnabled) return null;

        const currentMode = localMode ?? data.config.mode;
        const currentRetention = localRetentionDays ?? data.config.retentionDays;
        const isEnabled = currentMode !== 'off';

        return (
            <div className="mt-4 pt-4 border-t border-theme">
                {/* Section Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Activity size={16} className="text-accent" />
                        <span className="text-sm font-medium text-theme-primary">Metric History</span>
                    </div>
                    <Switch
                        checked={isEnabled}
                        onCheckedChange={handleToggle}
                        aria-label="Toggle metric history for this integration"
                    />
                </div>

                {/* Controls - only visible when enabled */}
                {isEnabled && (
                    <div className="space-y-3">
                        {/* Source Mode Selector */}
                        <div>
                            <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
                                Source Mode
                            </label>
                            <div className="flex gap-1.5">
                                {MODE_OPTIONS.map((option) => {
                                    const Icon = option.icon;
                                    const isActive = currentMode === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => handleModeChange(option.value)}
                                            className={`
                                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                                transition-all duration-150
                                                ${isActive
                                                    ? 'bg-accent/15 text-accent border border-accent/30'
                                                    : 'bg-theme-tertiary text-theme-secondary border border-theme hover:text-theme-primary hover:border-theme-light'
                                                }
                                            `}
                                            title={option.description}
                                        >
                                            <Icon size={12} />
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Retention Slider */}
                        <div>
                            <label className="text-xs font-medium text-theme-secondary mb-1 block">
                                Retention: {currentRetention} day{currentRetention !== 1 ? 's' : ''}
                            </label>
                            <Slider
                                value={currentRetention}
                                min={1}
                                max={30}
                                step={1}
                                onChange={handleRetentionChange}
                                aria-label="Retention days"
                            />
                            <div className="flex justify-between text-[10px] text-theme-tertiary mt-0.5">
                                <span>1d</span>
                                <span>30d</span>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        );
    }
);

MetricHistorySection.displayName = 'MetricHistorySection';

export default MetricHistorySection;

/**
 * DefaultsSection - Global defaults for monitors and metric history
 * 
 * Two sub-sections with per-group "Reset to Defaults" buttons and one shared Save.
 * Reset only modifies local state — Save must be pressed to persist.
 */

import React from 'react';
import { SlidersHorizontal, Save, RotateCcw, Loader2, Activity, Zap, HardDrive, Globe } from 'lucide-react';
import Input from '../../../components/common/Input';
import { SettingsSection } from '../../../shared/ui/settings';
import { Select } from '../../../shared/ui';
import { Slider } from '../../../shared/ui/Slider';
import type { MonitorDefaults, MetricHistoryDefaults } from '../types';

type MetricHistoryMode = MetricHistoryDefaults['mode'];

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

interface DefaultsSectionProps {
    monitorDefaults: MonitorDefaults | null;
    metricHistoryDefaults: MetricHistoryDefaults | null;
    isLoading: boolean;
    isSaving: boolean;
    hasAnyChanges: boolean;
    isMonitorNonFactory: boolean;
    isMetricHistoryNonFactory: boolean;
    onUpdateMonitor: (field: keyof MonitorDefaults, value: unknown) => void;
    onUpdateMetricHistory: (field: keyof MetricHistoryDefaults, value: unknown) => void;
    onSave: () => void;
    onRevertMonitor: () => void;
    onRevertMetricHistory: () => void;
}

export const DefaultsSection: React.FC<DefaultsSectionProps> = ({
    monitorDefaults,
    metricHistoryDefaults,
    isLoading,
    isSaving,
    hasAnyChanges,
    isMonitorNonFactory,
    isMetricHistoryNonFactory,
    onUpdateMonitor,
    onUpdateMetricHistory,
    onSave,
    onRevertMonitor,
    onRevertMetricHistory,
}) => {
    if (isLoading || !monitorDefaults || !metricHistoryDefaults) {
        return (
            <SettingsSection title="Defaults" icon={SlidersHorizontal}>
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-theme-secondary" />
                </div>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection
            title="Defaults"
            icon={SlidersHorizontal}
            description="Default values applied when creating new monitors and enabling metric history"
            headerRight={
                hasAnyChanges ? (
                    <button
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                                   bg-accent text-white hover:bg-accent/90
                                   transition-colors disabled:opacity-50"
                        disabled={isSaving}
                        onClick={onSave}
                    >
                        {isSaving ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <Save size={12} />
                        )}
                        Save
                    </button>
                ) : undefined
            }
        >
            {/* ── Service Monitors ─────────────────────────────── */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">
                        Service Monitors
                    </h4>
                    {isMonitorNonFactory && (
                        <button
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md
                                       text-theme-tertiary hover:text-theme-primary hover:bg-theme-hover
                                       transition-colors"
                            onClick={onRevertMonitor}
                            title="Reset monitor defaults to factory values"
                        >
                            <RotateCcw size={10} />
                            Reset
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Check Interval */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-theme-primary">
                            Check Interval
                        </label>
                        <Select value={monitorDefaults.intervalSeconds.toString()} onValueChange={(value: string) => onUpdateMonitor('intervalSeconds', parseInt(value))}>
                            <Select.Trigger className="w-full">
                                <Select.Value placeholder="Select interval" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="10">10 seconds</Select.Item>
                                <Select.Item value="30">30 seconds</Select.Item>
                                <Select.Item value="60">1 minute</Select.Item>
                                <Select.Item value="120">2 minutes</Select.Item>
                                <Select.Item value="300">5 minutes</Select.Item>
                            </Select.Content>
                        </Select>
                    </div>

                    {/* Timeout */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-theme-primary">
                            Request Timeout
                        </label>
                        <Select value={monitorDefaults.timeoutSeconds.toString()} onValueChange={(value: string) => onUpdateMonitor('timeoutSeconds', parseInt(value))}>
                            <Select.Trigger className="w-full">
                                <Select.Value placeholder="Select timeout" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="5">5 seconds</Select.Item>
                                <Select.Item value="10">10 seconds</Select.Item>
                                <Select.Item value="15">15 seconds</Select.Item>
                                <Select.Item value="30">30 seconds</Select.Item>
                                <Select.Item value="60">60 seconds</Select.Item>
                            </Select.Content>
                        </Select>
                    </div>

                    {/* Retries */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-theme-primary">
                            Retries Before Down
                        </label>
                        <Select value={monitorDefaults.retriesBeforeDown.toString()} onValueChange={(value: string) => onUpdateMonitor('retriesBeforeDown', parseInt(value))}>
                            <Select.Trigger className="w-full">
                                <Select.Value placeholder="Select retries" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="0">0 (immediate)</Select.Item>
                                <Select.Item value="1">1 retry</Select.Item>
                                <Select.Item value="2">2 retries</Select.Item>
                                <Select.Item value="3">3 retries</Select.Item>
                                <Select.Item value="5">5 retries</Select.Item>
                            </Select.Content>
                        </Select>
                    </div>

                    {/* Degraded Threshold */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-theme-primary">
                            Degraded Threshold
                        </label>
                        <Select value={monitorDefaults.degradedThresholdMs.toString()} onValueChange={(value: string) => onUpdateMonitor('degradedThresholdMs', parseInt(value))}>
                            <Select.Trigger className="w-full">
                                <Select.Value placeholder="Select threshold" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="500">500 ms</Select.Item>
                                <Select.Item value="1000">1 second</Select.Item>
                                <Select.Item value="2000">2 seconds</Select.Item>
                                <Select.Item value="3000">3 seconds</Select.Item>
                                <Select.Item value="5000">5 seconds</Select.Item>
                                <Select.Item value="10000">10 seconds</Select.Item>
                            </Select.Content>
                        </Select>
                    </div>

                    {/* Expected Status Codes */}
                    <div className="space-y-1.5 sm:col-span-2">
                        <Input
                            label="Expected Status Codes"
                            type="text"
                            size="sm"
                            value={monitorDefaults.expectedStatusCodes.join(', ')}
                            onChange={(e) => {
                                const codes = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                onUpdateMonitor('expectedStatusCodes', codes);
                            }}
                            placeholder="200-299, 301"
                            helperText="Comma-separated status codes or ranges (e.g. 200-299, 301, 302)"
                        />
                    </div>
                </div>
            </div>

            {/* ── Metric History ─────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-3 pt-4 border-t border-theme-light">
                    <div className="flex items-center gap-2">
                        <Activity size={14} className="text-accent" />
                        <h4 className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">
                            Metric History
                        </h4>
                    </div>
                    {isMetricHistoryNonFactory && (
                        <button
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md
                                       text-theme-tertiary hover:text-theme-primary hover:bg-theme-hover
                                       transition-colors"
                            onClick={onRevertMetricHistory}
                            title="Reset metric history defaults to factory values"
                        >
                            <RotateCcw size={10} />
                            Reset
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    {/* Source Mode */}
                    <div>
                        <label className="text-sm font-medium text-theme-primary mb-1.5 block">
                            Default Source Mode
                        </label>
                        <div className="flex gap-1.5">
                            {MODE_OPTIONS.map((option) => {
                                const Icon = option.icon;
                                const isActive = metricHistoryDefaults.mode === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => onUpdateMetricHistory('mode', option.value)}
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
                        <label className="text-sm font-medium text-theme-primary mb-1 block">
                            Default Retention: {metricHistoryDefaults.retentionDays} day{metricHistoryDefaults.retentionDays !== 1 ? 's' : ''}
                        </label>
                        <Slider
                            value={metricHistoryDefaults.retentionDays}
                            min={1}
                            max={30}
                            step={1}
                            onChange={(days) => onUpdateMetricHistory('retentionDays', days)}
                            aria-label="Default retention days"
                        />
                        <div className="flex justify-between text-[10px] text-theme-tertiary mt-0.5">
                            <span>1d</span>
                            <span>30d</span>
                        </div>
                    </div>
                </div>
            </div>
        </SettingsSection>
    );
};

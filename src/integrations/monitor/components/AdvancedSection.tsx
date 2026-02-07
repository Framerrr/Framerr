/**
 * AdvancedSection - Advanced monitoring settings UI
 * Check interval, timeout, retries, thresholds, expected status codes
 * All numeric fields use Select dropdowns for consistency.
 * Shows ↩ revert icons next to fields that differ from global defaults.
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../shared/ui';
import { AdvancedSectionProps } from '../types';
import { api } from '../../../api';

/** Shape of global monitor defaults from /api/jobs/monitor-defaults */
interface MonitorDefaults {
    intervalSeconds: number;
    timeoutSeconds: number;
    retriesBeforeDown: number;
    degradedThresholdMs: number;
    expectedStatusCodes: string[];
}

/** Inline revert button — shown next to a field whose value differs from the global default */
const RevertButton: React.FC<{ onClick: () => void; title?: string }> = ({ onClick, title = 'Revert to default' }) => (
    <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="text-accent hover:text-accent/80 transition-colors p-0.5"
        title={title}
    >
        <RotateCcw size={12} />
    </button>
);

/** Normalize status codes to a canonical string for comparison (sorted, trimmed, no spaces) */
function normalizeStatusCodes(value: string | string[] | undefined): string {
    if (!value) return '200-299';
    const parts = Array.isArray(value) ? value : value.split(',');
    return parts.map(s => s.trim()).filter(Boolean).sort().join(',');
}

const AdvancedSection: React.FC<AdvancedSectionProps> = ({
    monitor,
    onChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [defaults, setDefaults] = useState<MonitorDefaults | null>(null);

    // Fetch global defaults once when section is opened
    useEffect(() => {
        if (isOpen && !defaults) {
            api.get<MonitorDefaults>('/api/jobs/monitor-defaults')
                .then(setDefaults)
                .catch(() => { /* ignore — revert buttons just won't show */ });
        }
    }, [isOpen, defaults]);

    return (
        <>
            {/* Section toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-sm text-theme-secondary hover:text-theme-primary transition-colors"
            >
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Advanced Settings
            </button>

            {/* Section content */}
            {isOpen && (
                <div className="space-y-3 pl-4 border-l-2 border-theme">
                    <div className="grid grid-cols-2 gap-3">
                        {/* Check Interval */}
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <label className="block text-sm font-medium text-theme-primary">Check Interval</label>
                                {defaults && monitor.check_interval_seconds !== defaults.intervalSeconds && (
                                    <RevertButton
                                        onClick={() => onChange('check_interval_seconds', defaults.intervalSeconds)}
                                        title={`Revert to default (${defaults.intervalSeconds}s)`}
                                    />
                                )}
                            </div>
                            <Select value={monitor.check_interval_seconds.toString()} onValueChange={(value: string) => onChange('check_interval_seconds', parseInt(value))}>
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
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <label className="block text-sm font-medium text-theme-primary">Request Timeout</label>
                                {defaults && monitor.timeout_seconds !== defaults.timeoutSeconds && (
                                    <RevertButton
                                        onClick={() => onChange('timeout_seconds', defaults.timeoutSeconds)}
                                        title={`Revert to default (${defaults.timeoutSeconds}s)`}
                                    />
                                )}
                            </div>
                            <Select value={(monitor.timeout_seconds ?? 10).toString()} onValueChange={(value: string) => onChange('timeout_seconds', parseInt(value))}>
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
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Retries */}
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <label className="block text-sm font-medium text-theme-primary">Retries Before Down</label>
                                {defaults && monitor.retries_before_down !== defaults.retriesBeforeDown && (
                                    <RevertButton
                                        onClick={() => onChange('retries_before_down', defaults.retriesBeforeDown)}
                                        title={`Revert to default (${defaults.retriesBeforeDown})`}
                                    />
                                )}
                            </div>
                            <Select value={(monitor.retries_before_down ?? 3).toString()} onValueChange={(value: string) => onChange('retries_before_down', parseInt(value))}>
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

                        {/* Degraded threshold */}
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <label className="block text-sm font-medium text-theme-primary">Degraded Threshold</label>
                                {defaults && monitor.degraded_threshold_ms !== defaults.degradedThresholdMs && (
                                    <RevertButton
                                        onClick={() => onChange('degraded_threshold_ms', defaults.degradedThresholdMs)}
                                        title={`Revert to default (${defaults.degradedThresholdMs}ms)`}
                                    />
                                )}
                            </div>
                            <Select value={(monitor.degraded_threshold_ms ?? 2000).toString()} onValueChange={(value: string) => onChange('degraded_threshold_ms', parseInt(value))}>
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
                    </div>
                    {/* Expected status codes */}
                    {monitor.type === 'http' && (
                        <div>
                            <div className="flex items-center gap-1.5">
                                {defaults && normalizeStatusCodes(monitor.expected_status_codes) !== normalizeStatusCodes(defaults.expectedStatusCodes) && (
                                    <RevertButton
                                        onClick={() => onChange('expected_status_codes', defaults.expectedStatusCodes.join(','))}
                                        title={`Revert to default (${defaults.expectedStatusCodes.join(',')})`}
                                    />
                                )}
                            </div>
                            <Input
                                label="Expected status codes"
                                type="text"
                                size="sm"
                                value={monitor.expected_status_codes || '200-299'}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('expected_status_codes', e.target.value)}
                                placeholder="200-299"
                                helperText="Comma-separated, e.g. 200,201,204 or 200-299"
                            />
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default AdvancedSection;

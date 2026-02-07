/**
 * DefaultsSection - Global monitor default settings
 * 
 * Allows admins to set default values used when creating new service monitors.
 * Shows save/revert buttons when values have changed.
 * All numeric fields use Select dropdowns (same options as AdvancedSection).
 */

import React from 'react';
import { SlidersHorizontal, Save, RotateCcw, Loader2 } from 'lucide-react';
import Input from '../../../components/common/Input';
import { SettingsSection } from '../../../shared/ui/settings';
import { Select } from '../../../shared/ui';
import type { MonitorDefaults } from '../types';

interface DefaultsSectionProps {
    defaults: MonitorDefaults | null;
    isLoading: boolean;
    isSaving: boolean;
    hasChanges: boolean;
    onUpdate: (field: keyof MonitorDefaults, value: unknown) => void;
    onSave: () => void;
    onRevert: () => void;
}

export const DefaultsSection: React.FC<DefaultsSectionProps> = ({
    defaults,
    isLoading,
    isSaving,
    hasChanges,
    onUpdate,
    onSave,
    onRevert,
}) => {
    if (isLoading || !defaults) {
        return (
            <SettingsSection title="Monitor Defaults" icon={SlidersHorizontal}>
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-theme-secondary" />
                </div>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection
            title="Monitor Defaults"
            icon={SlidersHorizontal}
            description="Default values applied when creating new service monitors"
            headerRight={
                hasChanges ? (
                    <div className="flex items-center gap-2">
                        <button
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                                       bg-theme-hover text-theme-secondary hover:text-theme-primary
                                       transition-colors"
                            onClick={onRevert}
                        >
                            <RotateCcw size={12} />
                            Revert
                        </button>
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
                    </div>
                ) : undefined
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Check Interval */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-theme-primary">
                        Check Interval
                    </label>
                    <Select value={defaults.intervalSeconds.toString()} onValueChange={(value: string) => onUpdate('intervalSeconds', parseInt(value))}>
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
                    <Select value={defaults.timeoutSeconds.toString()} onValueChange={(value: string) => onUpdate('timeoutSeconds', parseInt(value))}>
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
                    <Select value={defaults.retriesBeforeDown.toString()} onValueChange={(value: string) => onUpdate('retriesBeforeDown', parseInt(value))}>
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
                    <Select value={defaults.degradedThresholdMs.toString()} onValueChange={(value: string) => onUpdate('degradedThresholdMs', parseInt(value))}>
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
                        value={defaults.expectedStatusCodes.join(', ')}
                        onChange={(e) => {
                            const codes = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            onUpdate('expectedStatusCodes', codes);
                        }}
                        placeholder="200-299, 301"
                        helperText="Comma-separated status codes or ranges (e.g. 200-299, 301, 302)"
                    />
                </div>
            </div>
        </SettingsSection>
    );
};

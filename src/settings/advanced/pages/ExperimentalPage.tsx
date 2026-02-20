import React, { useState, useEffect, useCallback } from 'react';
import { Beaker, Activity, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '../../../shared/ui/Switch/Switch';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog/ConfirmDialog';
import api from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { useNotifications } from '../../../context/NotificationContext';
import { SettingsPage, SettingsSection, EmptyState } from '../../../shared/ui/settings';

// ============================================================================
// Types
// ============================================================================

interface MetricHistoryStatus {
    success: boolean;
    enabled: boolean;
}

interface ToggleResponse {
    success: boolean;
    metricHistory: { enabled: boolean };
}

// ============================================================================
// Component
// ============================================================================

/**
 * ExperimentalPage - Feature flags and beta functionality
 *
 * Currently contains the Metric History Recording toggle.
 * When disabled → enabled: starts recording system-status metrics.
 * When enabled → disabled: shows confirmation dialog (data wipe).
 */
export const ExperimentalPage = (): React.JSX.Element => {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [showDisableConfirm, setShowDisableConfirm] = useState(false);
    const { success: showSuccess, error: showError } = useNotifications();
    const queryClient = useQueryClient();

    // Fetch current status on mount
    useEffect(() => {
        let cancelled = false;

        const fetchStatus = async () => {
            try {
                const data = await api.get<MetricHistoryStatus>('/api/metric-history/status');
                if (!cancelled) {
                    setEnabled(data.enabled);
                    setLoading(false);
                }
            } catch {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchStatus();
        return () => { cancelled = true; };
    }, []);

    // Toggle handler
    const handleToggle = useCallback(async (newValue: boolean) => {
        if (newValue) {
            // Enabling — just do it
            setToggling(true);
            try {
                await api.post<ToggleResponse>('/api/metric-history/toggle', { enabled: true });
                setEnabled(true);
                queryClient.invalidateQueries({ queryKey: queryKeys.metricHistory.status() });
                showSuccess('Metric History', 'Recording started for system status metrics');
            } catch {
                showError('Metric History', 'Failed to enable metric history');
            } finally {
                setToggling(false);
            }
        } else {
            // Disabling — show confirmation first
            setShowDisableConfirm(true);
        }
    }, [showSuccess, showError]);

    // Confirm disable (stops recording, preserves data)
    const handleConfirmDisable = useCallback(async () => {
        setToggling(true);
        try {
            await api.post<ToggleResponse>('/api/metric-history/toggle', { enabled: false });
            setEnabled(false);
            queryClient.invalidateQueries({ queryKey: queryKeys.metricHistory.status() });
            showSuccess('Metric History', 'Recording stopped. Existing data preserved and will expire based on retention settings.');
        } catch {
            showError('Metric History', 'Failed to disable metric history');
        } finally {
            setToggling(false);
            setShowDisableConfirm(false);
        }
    }, [showSuccess, showError]);

    return (
        <SettingsPage
            title="Experimental"
            description="Control experimental features and beta functionality"
        >
            {/* Metric History Toggle */}
            <SettingsSection
                title="Metric History Recording"
                icon={Activity}
                description="Record CPU, memory, and temperature history for system status integrations. Enables history graphs with up to 30 days of data."
                headerRight={
                    loading ? (
                        <Loader2 size={20} className="text-theme-tertiary animate-spin" />
                    ) : (
                        <Switch
                            checked={enabled}
                            onCheckedChange={handleToggle}
                            disabled={toggling}
                            aria-label="Toggle metric history recording"
                        />
                    )
                }
            >
                {/* Status indicator */}
                {!loading && (
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-success' : 'bg-theme-tertiary'}`} />
                        <span className="text-xs text-theme-tertiary">
                            {enabled ? 'Recording active' : 'Not recording'}
                        </span>
                    </div>
                )}

                {/* Warning notice */}
                {enabled && (
                    <div className="bg-info/10 rounded-xl p-4">
                        <div className="flex gap-3">
                            <Activity className="text-info flex-shrink-0 mt-0.5" size={20} />
                            <div className="text-sm text-theme-primary">
                                <p className="font-medium mb-1">Note</p>
                                <p className="text-theme-secondary">
                                    Disabling stops recording new data. Existing history is preserved and expires based on retention settings.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </SettingsSection>

            {/* More experimental features placeholder */}
            <SettingsSection title="More Features" icon={Beaker}>
                <EmptyState
                    icon={Beaker}
                    message="More experimental features coming soon"
                />
            </SettingsSection>

            {/* Disable confirmation dialog */}
            <ConfirmDialog
                open={showDisableConfirm}
                onOpenChange={setShowDisableConfirm}
                title="Disable Metric History?"
                message="This will stop recording new metric data. Existing history data is preserved and will expire based on retention settings."
                confirmLabel="Disable Recording"
                onConfirm={handleConfirmDisable}
                variant="warning"
                loading={toggling}
            />
        </SettingsPage>
    );
};

export default ExperimentalPage;

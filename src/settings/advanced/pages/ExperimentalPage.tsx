import React, { useState, useEffect, useCallback } from 'react';
import { Beaker, Activity, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '../../../shared/ui/Switch/Switch';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog/ConfirmDialog';
import api from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { useNotifications } from '../../../context/NotificationContext';

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
        <div className="space-y-6">
            {/* Page Header */}
            <div className="pl-4 md:pl-2">
                <h3 className="text-xl font-bold text-theme-primary mb-1">Experimental</h3>
                <p className="text-theme-secondary text-sm">
                    Control experimental features and beta functionality
                </p>
            </div>

            {/* Metric History Toggle Card */}
            <div className="glass-subtle rounded-xl shadow-medium p-6 border border-theme">
                <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Activity size={20} className="text-accent" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h4 className="text-theme-primary font-medium">Metric History Recording</h4>
                                <p className="text-theme-secondary text-sm mt-1">
                                    Record CPU, memory, and temperature history for system status integrations.
                                    Enables history graphs with up to 30 days of data.
                                </p>
                            </div>

                            {/* Toggle */}
                            <div className="flex-shrink-0">
                                {loading ? (
                                    <Loader2 size={20} className="text-theme-tertiary animate-spin" />
                                ) : (
                                    <Switch
                                        checked={enabled}
                                        onCheckedChange={handleToggle}
                                        disabled={toggling}
                                        aria-label="Toggle metric history recording"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Status indicator */}
                        {!loading && (
                            <div className="mt-3 flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-success' : 'bg-theme-tertiary'}`} />
                                <span className="text-xs text-theme-tertiary">
                                    {enabled ? 'Recording active' : 'Not recording'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Warning notice */}
                {enabled && (
                    <div className="mt-4 p-3 rounded-lg bg-info/5 border border-info/20">
                        <p className="text-xs text-theme-secondary">
                            <span className="font-medium text-info">Note:</span>{' '}
                            Disabling stops recording new data. Existing history is preserved and expires based on retention settings.
                        </p>
                    </div>
                )}
            </div>

            {/* More experimental features placeholder */}
            <div className="glass-subtle rounded-xl shadow-medium p-8 text-center border border-theme">
                <Beaker size={40} className="mx-auto mb-3 text-theme-tertiary" />
                <p className="text-theme-secondary text-sm">
                    More experimental features coming soon
                </p>
            </div>

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
        </div>
    );
};

export default ExperimentalPage;

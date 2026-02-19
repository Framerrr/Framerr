/**
 * JobsPage - Background jobs, cache management, and monitor defaults (Admin only)
 * 
 * Thin orchestrator that composes jobs, cache, and defaults sections.
 * All state management is handled by useJobsSettings hook.
 */

import React from 'react';
import { useJobsSettings } from '../../jobs/hooks/useJobsSettings';
import { JobsSection } from '../../jobs/sections/JobsSection';
import { CacheSection } from '../../jobs/sections/CacheSection';
import { DefaultsSection } from '../../jobs/sections/DefaultsSection';
import { SettingsPage, SettingsAlert } from '../../../shared/ui/settings';

export const JobsPage = (): React.JSX.Element => {
    const {
        jobs,
        isLoadingJobs,
        triggeringJobId,
        handleTriggerJob,

        cacheStats,
        isLoadingCache,
        flushingCache,
        syncingIntegration,
        handleFlushTmdbMetadata,
        handleFlushTmdbImages,
        handleClearSearchHistory,
        handleFlushLibrary,
        handleFlushAllLibrary,
        handleSyncLibrary,
        handleFlushMetricHistory,
        handleFlushMetricHistoryIntegration,

        monitorDefaults,
        metricHistoryDefaults,
        isLoadingDefaults,
        isSavingDefaults,
        hasAnyDefaultsChanges,
        isMonitorNonFactory,
        isMetricHistoryNonFactory,
        updateMonitorDefault,
        updateMetricHistoryDefault,
        handleSaveDefaults,
        handleRevertMonitorDefaults,
        handleRevertMetricHistoryDefaults,

        error,
        success,
    } = useJobsSettings();

    return (
        <SettingsPage
            title="Jobs & Cache"
            description="Manage background tasks, cached data, and monitor defaults"
        >
            {/* Error/Success Messages */}
            {error && (
                <SettingsAlert type="error">{error}</SettingsAlert>
            )}
            {success && (
                <SettingsAlert type="success">{success}</SettingsAlert>
            )}

            {/* Background Jobs Table */}
            <JobsSection
                jobs={jobs}
                isLoading={isLoadingJobs}
                triggeringJobId={triggeringJobId}
                onTriggerJob={handleTriggerJob}
            />

            {/* Cache Management Table */}
            <CacheSection
                cacheStats={cacheStats}
                isLoading={isLoadingCache}
                flushingCache={flushingCache}
                syncingIntegration={syncingIntegration}
                onFlushTmdbMetadata={handleFlushTmdbMetadata}
                onFlushTmdbImages={handleFlushTmdbImages}
                onClearSearchHistory={handleClearSearchHistory}
                onFlushLibrary={handleFlushLibrary}
                onFlushAllLibrary={handleFlushAllLibrary}
                onSyncLibrary={handleSyncLibrary}
                onFlushMetricHistory={handleFlushMetricHistory}
                onFlushMetricHistoryIntegration={handleFlushMetricHistoryIntegration}
            />

            {/* Defaults (Monitor + Metric History) */}
            <DefaultsSection
                monitorDefaults={monitorDefaults}
                metricHistoryDefaults={metricHistoryDefaults}
                isLoading={isLoadingDefaults}
                isSaving={isSavingDefaults}
                hasAnyChanges={hasAnyDefaultsChanges}
                isMonitorNonFactory={isMonitorNonFactory}
                isMetricHistoryNonFactory={isMetricHistoryNonFactory}
                onUpdateMonitor={updateMonitorDefault}
                onUpdateMetricHistory={updateMetricHistoryDefault}
                onSave={handleSaveDefaults}
                onRevertMonitor={handleRevertMonitorDefaults}
                onRevertMetricHistory={handleRevertMetricHistoryDefaults}
            />
        </SettingsPage>
    );
};

export default JobsPage;

/**
 * useJobsSettings - State management for Jobs & Cache page
 * 
 * Fetches jobs, cache stats, handles flush/sync operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../api';
import { extractErrorMessage } from '../../../api';
import { useToasts } from '../../../context/notification';
import logger from '../../../utils/logger';
import type { JobStatus, CacheStats, MonitorDefaults, MetricHistoryDefaults, AllDefaults } from '../types';

/** Minimum spinner duration (ms) so users perceive the action happening */
const MIN_ACTION_DELAY = 2000;

/** Run an async action with a minimum display time for the loading spinner */
function withMinDelay<T>(action: Promise<T>): Promise<T> {
    return Promise.all([action, new Promise(r => setTimeout(r, MIN_ACTION_DELAY))]).then(([result]) => result);
}

interface UseJobsSettingsReturn {
    // Jobs
    jobs: JobStatus[];
    isLoadingJobs: boolean;
    triggeringJobId: string | null;
    handleTriggerJob: (jobId: string) => Promise<void>;
    refreshJobs: () => Promise<void>;

    // Cache
    cacheStats: CacheStats | null;
    isLoadingCache: boolean;
    flushingCache: string | null;
    syncingIntegration: string | null;
    handleFlushTmdbMetadata: () => Promise<void>;
    handleFlushTmdbImages: () => Promise<void>;
    handleClearSearchHistory: () => Promise<void>;
    handleFlushLibrary: (integrationId: string) => Promise<void>;
    handleFlushAllLibrary: () => Promise<void>;
    handleSyncLibrary: (integrationId: string) => Promise<void>;
    handleFlushMetricHistory: () => Promise<void>;
    handleFlushMetricHistoryIntegration: (integrationId: string) => Promise<void>;
    refreshCacheStats: () => Promise<void>;

    // Defaults
    monitorDefaults: MonitorDefaults | null;
    metricHistoryDefaults: MetricHistoryDefaults | null;
    isLoadingDefaults: boolean;
    isSavingDefaults: boolean;
    hasMonitorChanges: boolean;
    hasMetricHistoryChanges: boolean;
    hasAnyDefaultsChanges: boolean;
    isMonitorNonFactory: boolean;
    isMetricHistoryNonFactory: boolean;
    updateMonitorDefault: (field: keyof MonitorDefaults, value: unknown) => void;
    updateMetricHistoryDefault: (field: keyof MetricHistoryDefaults, value: unknown) => void;
    handleSaveDefaults: () => Promise<void>;
    handleRevertMonitorDefaults: () => void;
    handleRevertMetricHistoryDefaults: () => void;

}

/** Factory defaults — matches DEFAULT_CONFIG in systemConfig.ts */
const MONITOR_FACTORY_DEFAULTS: MonitorDefaults = {
    intervalSeconds: 60,
    timeoutSeconds: 10,
    retriesBeforeDown: 3,
    degradedThresholdMs: 2000,
    expectedStatusCodes: ['200-299'],
};

const METRIC_HISTORY_FACTORY_DEFAULTS: MetricHistoryDefaults = {
    mode: 'auto',
    retentionDays: 3,
};

export function useJobsSettings(): UseJobsSettingsReturn {
    const [jobs, setJobs] = useState<JobStatus[]>([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [triggeringJobId, setTriggeringJobId] = useState<string | null>(null);

    const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
    const [isLoadingCache, setIsLoadingCache] = useState(true);
    const [flushingCache, setFlushingCache] = useState<string | null>(null);
    const [syncingIntegration, setSyncingIntegration] = useState<string | null>(null);

    const [monitorDefaults, setMonitorDefaults] = useState<MonitorDefaults | null>(null);
    const [savedMonitorDefaults, setSavedMonitorDefaults] = useState<MonitorDefaults | null>(null);
    const [metricHistoryDefaults, setMetricHistoryDefaults] = useState<MetricHistoryDefaults | null>(null);
    const [savedMetricHistoryDefaults, setSavedMetricHistoryDefaults] = useState<MetricHistoryDefaults | null>(null);
    const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
    const [isSavingDefaults, setIsSavingDefaults] = useState(false);

    const toast = useToasts();

    // ---- Fetching ----

    const refreshJobs = useCallback(async () => {
        try {
            const data = await api.get<{ jobs: JobStatus[] }>('/api/jobs');
            setJobs(data.jobs);
        } catch (err) {
            logger.error('[JobsSettings] Failed to fetch jobs', { error: err });
        } finally {
            setIsLoadingJobs(false);
        }
    }, []);

    const refreshCacheStats = useCallback(async () => {
        try {
            const data = await api.get<CacheStats>('/api/jobs/cache/stats');
            setCacheStats(data);
        } catch (err) {
            logger.error('[JobsSettings] Failed to fetch cache stats', { error: err });
        } finally {
            setIsLoadingCache(false);
        }
    }, []);

    const refreshDefaults = useCallback(async () => {
        try {
            const data = await api.get<AllDefaults>('/api/jobs/defaults');
            setMonitorDefaults(data.monitorDefaults);
            setSavedMonitorDefaults(data.monitorDefaults);
            setMetricHistoryDefaults(data.metricHistoryDefaults);
            setSavedMetricHistoryDefaults(data.metricHistoryDefaults);
        } catch (err) {
            logger.error('[JobsSettings] Failed to fetch defaults', { error: err });
        } finally {
            setIsLoadingDefaults(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        refreshJobs();
        refreshCacheStats();
        refreshDefaults();
    }, [refreshJobs, refreshCacheStats, refreshDefaults]);

    // Auto-refresh jobs every 30s for live countdown
    useEffect(() => {
        const interval = setInterval(refreshJobs, 30000);
        return () => clearInterval(interval);
    }, [refreshJobs]);

    // ---- Job Actions ----

    const handleTriggerJob = useCallback(async (jobId: string) => {
        setTriggeringJobId(jobId);
        let isAsync = false;

        try {
            const data = await api.post<{ success: boolean; libraryCount?: number }>(`/api/jobs/${jobId}/run`);

            // Library sync: async trigger — show toast immediately, poll for completion
            if (typeof data.libraryCount === 'number') {
                isAsync = true;
                const count = data.libraryCount;
                if (count === 0) {
                    toast.info('Library Sync', 'No libraries have sync enabled');
                    setTriggeringJobId(null);
                } else {
                    toast.success('Library Sync Started', `Syncing ${count} ${count === 1 ? 'library' : 'libraries'}`);
                    // Poll until job finishes (status goes idle), then clear spinner
                    const pollInterval = setInterval(async () => {
                        try {
                            const jobData = await api.get<{ jobs: JobStatus[] }>('/api/jobs');
                            const job = jobData.jobs.find(j => j.id === jobId);
                            if (!job || job.status !== 'running') {
                                clearInterval(pollInterval);
                                setTriggeringJobId(null);
                                await refreshJobs();
                            }
                        } catch {
                            clearInterval(pollInterval);
                            setTriggeringJobId(null);
                        }
                    }, 5000);
                }
                return;
            }

            // All other jobs: synchronous — already complete when we get here
            toast.success('Job Triggered', 'Job completed successfully');
            await refreshJobs();
        } catch (err) {
            toast.error('Job Failed', extractErrorMessage(err));
        } finally {
            // Only clear for synchronous jobs (async ones manage their own cleanup via polling)
            if (!isAsync) {
                setTriggeringJobId(null);
            }
        }
    }, [refreshJobs, toast]);

    // ---- Cache Actions ----

    const handleFlushTmdbMetadata = useCallback(async () => {
        setFlushingCache('tmdb-metadata');

        try {
            const data = await withMinDelay(api.post<{ deleted: number }>('/api/jobs/cache/tmdb-metadata/flush'));
            toast.success('Cache Flushed', `Flushed ${data.deleted} TMDB metadata entries`);
            await refreshCacheStats();
        } catch (err) {
            toast.error('Flush Failed', extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats, toast]);

    const handleFlushTmdbImages = useCallback(async () => {
        setFlushingCache('tmdb-images');

        try {
            const data = await withMinDelay(api.post<{ deleted: number; freed: number }>('/api/jobs/cache/tmdb-images/flush'));
            toast.success('Cache Flushed', `Flushed ${data.deleted} TMDB images`);
            await refreshCacheStats();
        } catch (err) {
            toast.error('Flush Failed', extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats, toast]);

    const handleClearSearchHistory = useCallback(async () => {
        setFlushingCache('search-history');

        try {
            const data = await withMinDelay(api.post<{ deleted: number }>('/api/jobs/cache/search-history/clear'));
            toast.success('History Cleared', `Cleared ${data.deleted} search history entries`);
            await refreshCacheStats();
        } catch (err) {
            toast.error('Clear Failed', extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats, toast]);

    const handleFlushLibrary = useCallback(async (integrationId: string) => {
        setFlushingCache(`library-${integrationId}`);

        try {
            await withMinDelay(api.post(`/api/jobs/cache/library/${integrationId}/flush`));
            toast.success('Cache Flushed', 'Library cache flushed successfully');
            await refreshCacheStats();
        } catch (err) {
            toast.error('Flush Failed', extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats, toast]);

    const handleFlushAllLibrary = useCallback(async () => {
        setFlushingCache('library-all');

        try {
            const data = await withMinDelay(api.post<{ deleted: number }>('/api/jobs/cache/library/flush'));
            toast.success('Cache Flushed', `Flushed library cache for ${data.deleted} integrations`);
            await refreshCacheStats();
        } catch (err) {
            toast.error('Flush Failed', extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats, toast]);

    const handleSyncLibrary = useCallback(async (integrationId: string) => {
        setSyncingIntegration(integrationId);

        try {
            await withMinDelay(api.post(`/api/jobs/cache/library/${integrationId}/sync`));
            toast.success('Sync Started', 'Library sync started');
        } catch (err) {
            toast.error('Sync Failed', extractErrorMessage(err));
        } finally {
            setSyncingIntegration(null);
        }
    }, [toast]);

    const handleFlushMetricHistory = useCallback(async () => {
        setFlushingCache('metric-history');

        try {
            const data = await withMinDelay(api.post<{ deleted: number }>('/api/jobs/cache/metric-history/flush'));
            toast.success('Cache Flushed', `Flushed ${data.deleted} metric history entries`);
            await refreshCacheStats();
        } catch (err) {
            toast.error('Flush Failed', extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats, toast]);

    const handleFlushMetricHistoryIntegration = useCallback(async (integrationId: string) => {
        setFlushingCache(`metric-history-${integrationId}`);

        try {
            await withMinDelay(api.post(`/api/jobs/cache/metric-history/${integrationId}/flush`));
            toast.success('Cache Flushed', 'Flushed metric history for integration');
            await refreshCacheStats();
        } catch (err) {
            toast.error('Flush Failed', extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats, toast]);

    // ---- Monitor Default Actions ----

    const updateMonitorDefault = useCallback((field: keyof MonitorDefaults, value: unknown) => {
        setMonitorDefaults(prev => prev ? { ...prev, [field]: value } : null);
    }, []);

    const updateMetricHistoryDefault = useCallback((field: keyof MetricHistoryDefaults, value: unknown) => {
        setMetricHistoryDefaults(prev => prev ? { ...prev, [field]: value } : null);
    }, []);

    // Compare current values to saved values to detect changes
    const hasMonitorChanges = monitorDefaults && savedMonitorDefaults
        ? JSON.stringify(monitorDefaults) !== JSON.stringify(savedMonitorDefaults)
        : false;

    const hasMetricHistoryChanges = metricHistoryDefaults && savedMetricHistoryDefaults
        ? JSON.stringify(metricHistoryDefaults) !== JSON.stringify(savedMetricHistoryDefaults)
        : false;

    const hasAnyDefaultsChanges = hasMonitorChanges || hasMetricHistoryChanges;

    // Check if current values differ from factory defaults (for per-group revert visibility)
    const isMonitorNonFactory = monitorDefaults
        ? JSON.stringify(monitorDefaults) !== JSON.stringify(MONITOR_FACTORY_DEFAULTS)
        : false;

    const isMetricHistoryNonFactory = metricHistoryDefaults
        ? JSON.stringify(metricHistoryDefaults) !== JSON.stringify(METRIC_HISTORY_FACTORY_DEFAULTS)
        : false;

    const handleSaveDefaults = useCallback(async () => {
        if (!monitorDefaults || !metricHistoryDefaults) return;
        setIsSavingDefaults(true);

        try {
            const saved = await withMinDelay(api.put<AllDefaults>('/api/jobs/defaults', {
                monitorDefaults,
                metricHistoryDefaults,
            }));
            setMonitorDefaults(saved.monitorDefaults);
            setSavedMonitorDefaults(saved.monitorDefaults);
            setMetricHistoryDefaults(saved.metricHistoryDefaults);
            setSavedMetricHistoryDefaults(saved.metricHistoryDefaults);
            toast.success('Defaults Saved', 'Monitor and metric history defaults updated');
        } catch (err) {
            toast.error('Save Failed', extractErrorMessage(err));
        } finally {
            setIsSavingDefaults(false);
        }
    }, [monitorDefaults, metricHistoryDefaults, toast]);

    const handleRevertMonitorDefaults = useCallback(() => {
        setMonitorDefaults({ ...MONITOR_FACTORY_DEFAULTS });
    }, []);

    const handleRevertMetricHistoryDefaults = useCallback(() => {
        setMetricHistoryDefaults({ ...METRIC_HISTORY_FACTORY_DEFAULTS });
    }, []);

    return {
        jobs,
        isLoadingJobs,
        triggeringJobId,
        handleTriggerJob,
        refreshJobs,

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
        refreshCacheStats,

        monitorDefaults,
        metricHistoryDefaults,
        isLoadingDefaults,
        isSavingDefaults,
        hasMonitorChanges,
        hasMetricHistoryChanges,
        hasAnyDefaultsChanges,
        isMonitorNonFactory,
        isMetricHistoryNonFactory,
        updateMonitorDefault,
        updateMetricHistoryDefault,
        handleSaveDefaults,
        handleRevertMonitorDefaults,
        handleRevertMetricHistoryDefaults,
    };
}

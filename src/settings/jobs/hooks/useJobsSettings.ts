/**
 * useJobsSettings - State management for Jobs & Cache page
 * 
 * Fetches jobs, cache stats, handles flush/sync operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../api';
import { extractErrorMessage } from '../../../api';
import logger from '../../../utils/logger';
import type { JobStatus, CacheStats, MonitorDefaults, MetricHistoryDefaults, AllDefaults } from '../types';

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

    // Messages
    error: string;
    success: string;
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

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // ---- Fetching ----

    const refreshJobs = useCallback(async () => {
        try {
            const data = await api.get<{ jobs: JobStatus[] }>('/api/jobs');
            setJobs(data.jobs);
        } catch (err) {
            logger.error('[JobsSettings] Failed to fetch jobs', { error: err });
            setError(extractErrorMessage(err));
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
            setError(extractErrorMessage(err));
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
        setError('');
        setSuccess('');

        try {
            await api.post(`/api/jobs/${jobId}/run`);
            setSuccess(`Job triggered successfully`);
            await refreshJobs();
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setTriggeringJobId(null);
        }
    }, [refreshJobs]);

    // ---- Cache Actions ----

    const handleFlushTmdbMetadata = useCallback(async () => {
        setFlushingCache('tmdb-metadata');
        setError('');
        setSuccess('');

        try {
            const data = await api.post<{ deleted: number }>('/api/jobs/cache/tmdb-metadata/flush');
            setSuccess(`Flushed ${data.deleted} TMDB metadata entries`);
            await refreshCacheStats();
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats]);

    const handleFlushTmdbImages = useCallback(async () => {
        setFlushingCache('tmdb-images');
        setError('');
        setSuccess('');

        try {
            const data = await api.post<{ deleted: number; freed: number }>('/api/jobs/cache/tmdb-images/flush');
            setSuccess(`Flushed ${data.deleted} TMDB images`);
            await refreshCacheStats();
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats]);

    const handleClearSearchHistory = useCallback(async () => {
        setFlushingCache('search-history');
        setError('');
        setSuccess('');

        try {
            const data = await api.post<{ deleted: number }>('/api/jobs/cache/search-history/clear');
            setSuccess(`Cleared ${data.deleted} search history entries`);
            await refreshCacheStats();
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats]);

    const handleFlushLibrary = useCallback(async (integrationId: string) => {
        setFlushingCache(`library-${integrationId}`);
        setError('');
        setSuccess('');

        try {
            await api.post(`/api/jobs/cache/library/${integrationId}/flush`);
            setSuccess('Library cache flushed successfully');
            await refreshCacheStats();
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats]);

    const handleFlushAllLibrary = useCallback(async () => {
        setFlushingCache('library-all');
        setError('');
        setSuccess('');

        try {
            const data = await api.post<{ deleted: number }>('/api/jobs/cache/library/flush');
            setSuccess(`Flushed library cache for ${data.deleted} integrations`);
            await refreshCacheStats();
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats]);

    const handleSyncLibrary = useCallback(async (integrationId: string) => {
        setSyncingIntegration(integrationId);
        setError('');
        setSuccess('');

        try {
            await api.post(`/api/jobs/cache/library/${integrationId}/sync`);
            setSuccess('Library sync started');
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setSyncingIntegration(null);
        }
    }, []);

    const handleFlushMetricHistory = useCallback(async () => {
        setFlushingCache('metric-history');
        setError('');
        setSuccess('');

        try {
            const data = await api.post<{ deleted: number }>('/api/jobs/cache/metric-history/flush');
            setSuccess(`Flushed ${data.deleted} metric history entries`);
            await refreshCacheStats();
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats]);

    const handleFlushMetricHistoryIntegration = useCallback(async (integrationId: string) => {
        setFlushingCache(`metric-history-${integrationId}`);
        setError('');
        setSuccess('');

        try {
            await api.post(`/api/jobs/cache/metric-history/${integrationId}/flush`);
            setSuccess('Flushed metric history for integration');
            await refreshCacheStats();
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setFlushingCache(null);
        }
    }, [refreshCacheStats]);

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
        setError('');
        setSuccess('');

        try {
            const saved = await api.put<AllDefaults>('/api/jobs/defaults', {
                monitorDefaults,
                metricHistoryDefaults,
            });
            setMonitorDefaults(saved.monitorDefaults);
            setSavedMonitorDefaults(saved.monitorDefaults);
            setMetricHistoryDefaults(saved.metricHistoryDefaults);
            setSavedMetricHistoryDefaults(saved.metricHistoryDefaults);
            setSuccess('Defaults saved');
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setIsSavingDefaults(false);
        }
    }, [monitorDefaults, metricHistoryDefaults]);

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

        error,
        success,
    };
}

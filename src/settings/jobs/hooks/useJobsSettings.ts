/**
 * useJobsSettings - State management for Jobs & Cache page
 * 
 * Fetches jobs, cache stats, handles flush/sync operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../api';
import { extractErrorMessage } from '../../../api';
import logger from '../../../utils/logger';
import type { JobStatus, CacheStats, MonitorDefaults } from '../types';

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
    handleSyncLibrary: (integrationId: string) => Promise<void>;
    refreshCacheStats: () => Promise<void>;

    // Monitor Defaults
    monitorDefaults: MonitorDefaults | null;
    isLoadingDefaults: boolean;
    isSavingDefaults: boolean;
    defaultsChanged: boolean;
    updateMonitorDefault: (field: keyof MonitorDefaults, value: unknown) => void;
    handleSaveDefaults: () => Promise<void>;
    handleRevertDefaults: () => void;

    // Messages
    error: string;
    success: string;
}

/** Factory defaults — matches DEFAULT_CONFIG.monitorDefaults in systemConfig.ts */
const FACTORY_DEFAULTS: MonitorDefaults = {
    intervalSeconds: 60,
    timeoutSeconds: 10,
    retriesBeforeDown: 3,
    degradedThresholdMs: 2000,
    expectedStatusCodes: ['200-299'],
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
    const [savedDefaults, setSavedDefaults] = useState<MonitorDefaults | null>(null);
    const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
    const [isSavingDefaults, setIsSavingDefaults] = useState(false);
    const [defaultsChanged, setDefaultsChanged] = useState(false);

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
            const data = await api.get<MonitorDefaults>('/api/jobs/monitor-defaults');
            setMonitorDefaults(data);
            setSavedDefaults(data);
            setDefaultsChanged(false);
        } catch (err) {
            logger.error('[JobsSettings] Failed to fetch monitor defaults', { error: err });
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

    // ---- Monitor Default Actions ----

    const updateMonitorDefault = useCallback((field: keyof MonitorDefaults, value: unknown) => {
        setMonitorDefaults(prev => prev ? { ...prev, [field]: value } : null);
        setDefaultsChanged(true);
    }, []);

    const handleSaveDefaults = useCallback(async () => {
        if (!monitorDefaults) return;
        setIsSavingDefaults(true);
        setError('');
        setSuccess('');

        try {
            const saved = await api.put<MonitorDefaults>('/api/jobs/monitor-defaults', monitorDefaults);
            setMonitorDefaults(saved);
            setSavedDefaults(saved);
            setDefaultsChanged(false);
            setSuccess('Monitor defaults saved');
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setIsSavingDefaults(false);
        }
    }, [monitorDefaults]);

    const handleRevertDefaults = useCallback(() => {
        setMonitorDefaults({ ...FACTORY_DEFAULTS });
        setDefaultsChanged(true);
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
        handleSyncLibrary,
        refreshCacheStats,

        monitorDefaults,
        isLoadingDefaults,
        isSavingDefaults,
        defaultsChanged,
        updateMonitorDefault,
        handleSaveDefaults,
        handleRevertDefaults,

        error,
        success,
    };
}

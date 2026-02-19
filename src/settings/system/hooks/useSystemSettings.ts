/**
 * useSystemSettings Hook
 * 
 * State management for the System Settings diagnostics page.
 * 
 * P2 Migration: Hybrid pattern
 * - Server state (queries): System info, resources, health via React Query
 * - Imperative operations: Database test, speed test (local state)
 */

import { useState, useCallback, useMemo } from 'react';
import { systemApi, type SseStatus, type DbStatus, type ApiHealth } from '@/api';
import {
    useSystemInfo,
    useSystemResources,
    useSseStatus,
    useApiHealth,
} from '../../../api/hooks/useDashboard';
import logger from '../../../utils/logger';
import type {
    SystemInfo,
    Resources,
    SpeedTestState,
    HealthStatus
} from '../types';

interface UseSystemSettingsReturn {
    // System Information
    systemInfo: SystemInfo | null;
    resources: Resources | null;
    loading: boolean;
    refreshing: boolean;
    handleRefresh: () => Promise<void>;
    formatUptime: (seconds: number) => string;

    // Health Status
    sseStatus: SseStatus | null;
    healthLoading: boolean;
    fetchHealthStatus: () => Promise<void>;

    // Database
    dbStatus: DbStatus | null;
    dbLoading: boolean;
    testDatabase: () => Promise<void>;

    // Speed Test
    speedTest: SpeedTestState;
    runSpeedTest: () => Promise<void>;

    // API Health
    apiHealth: ApiHealth | null;
    apiLoading: boolean;
    testApiHealth: () => Promise<void>;

    // Combined
    handleRefreshDiagnostics: () => Promise<void>;

    // UI Helpers
    getStatusColor: (status: HealthStatus) => string;
}

export function useSystemSettings(): UseSystemSettingsReturn {
    // ========================================================================
    // Server State (React Query)
    // ========================================================================

    const {
        data: systemInfoResponse,
        isLoading: systemInfoLoading,
        refetch: refetchSystemInfo,
        isRefetching: systemInfoRefetching,
    } = useSystemInfo();

    const {
        data: resourcesResponse,
        isLoading: resourcesLoading,
        refetch: refetchResources,
        isRefetching: resourcesRefetching,
    } = useSystemResources();

    const {
        data: sseStatusResponse,
        isLoading: sseLoading,
        refetch: refetchSseStatus,
    } = useSseStatus();

    const {
        data: apiHealthResponse,
        isLoading: apiHealthLoading,
        refetch: refetchApiHealth,
    } = useApiHealth();

    // Unwrap data from responses
    const systemInfo = useMemo<SystemInfo | null>(() => {
        if (systemInfoResponse?.success && systemInfoResponse?.data) {
            return systemInfoResponse.data;
        }
        return null;
    }, [systemInfoResponse]);

    const resources = useMemo<Resources | null>(() => {
        if (resourcesResponse?.success && resourcesResponse?.data) {
            return resourcesResponse.data;
        }
        return null;
    }, [resourcesResponse]);


    const sseStatus = useMemo<SseStatus | null>(() => {
        if (sseStatusResponse?.success) {
            return sseStatusResponse;
        }
        return null;
    }, [sseStatusResponse]);

    const apiHealth = useMemo<ApiHealth | null>(() => {
        return apiHealthResponse ?? null;
    }, [apiHealthResponse]);

    // Derived loading states
    const loading = systemInfoLoading || resourcesLoading;
    const refreshing = systemInfoRefetching || resourcesRefetching;
    const healthLoading = sseLoading;
    const apiLoading = apiHealthLoading;

    // ========================================================================
    // Local State (Imperative operations)
    // ========================================================================

    const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
    const [dbLoading, setDbLoading] = useState<boolean>(false);
    const [speedTest, setSpeedTest] = useState<SpeedTestState>({
        running: false,
        latency: null,
        download: null,
        upload: null,
        jitter: null,
        stage: null
    });

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleRefresh = useCallback(async (): Promise<void> => {
        await Promise.all([
            refetchSystemInfo(),
            refetchResources()
        ]);
    }, [refetchSystemInfo, refetchResources]);

    const fetchHealthStatus = useCallback(async (): Promise<void> => {
        await refetchSseStatus();
    }, [refetchSseStatus]);

    const testApiHealthHandler = useCallback(async (): Promise<void> => {
        await refetchApiHealth();
    }, [refetchApiHealth]);

    const testDatabase = useCallback(async (): Promise<void> => {
        setDbLoading(true);
        try {
            const response = await systemApi.testDatabase();
            setDbStatus(response);
        } catch (error) {
            setDbStatus({
                success: false,
                status: 'error',
                error: (error as Error).message
            });
        } finally {
            setDbLoading(false);
        }
    }, []);

    const runSpeedTest = useCallback(async (): Promise<void> => {
        setSpeedTest({ running: true, latency: null, download: null, upload: null, jitter: null, stage: 'latency' });

        try {
            // 0. TCP WARMUP - prime the connection
            await systemApi.speedTestWarmup();

            // 1. LATENCY TEST (10 pings, calculate jitter)
            const pings: number[] = [];
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                await systemApi.speedTestPing();
                pings.push(Date.now() - start);
            }
            const avgLatency = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
            const jitter = Math.round(pings.reduce((sum, p) => sum + Math.abs(p - avgLatency), 0) / pings.length);
            setSpeedTest(prev => ({ ...prev, latency: avgLatency, jitter, stage: 'download' }));

            // 2. DOWNLOAD TEST - Multi-sample: 3 tests with 25MB each
            const downloadSpeeds: number[] = [];
            for (let i = 0; i < 3; i++) {
                const downloadStart = Date.now();
                const downloadBlob = await systemApi.speedTestDownload(25);
                const downloadTime = (Date.now() - downloadStart) / 1000;
                const downloadBytes = downloadBlob.size;
                downloadSpeeds.push((downloadBytes * 8) / downloadTime / 1000000);
                await new Promise(r => setTimeout(r, 100));
            }
            downloadSpeeds.sort((a, b) => b - a);
            const bestDownloads = downloadSpeeds.slice(0, 2);
            const downloadMbps = (bestDownloads.reduce((a, b) => a + b, 0) / bestDownloads.length).toFixed(2);
            setSpeedTest(prev => ({ ...prev, download: downloadMbps, stage: 'upload' }));

            // 3. UPLOAD TEST - Multi-sample: 3 tests with 5MB each
            const uploadSpeeds: number[] = [];
            const uploadData = { data: 'x'.repeat(5 * 1024 * 1024) };
            const uploadBytes = JSON.stringify(uploadData).length;
            for (let i = 0; i < 3; i++) {
                const uploadStart = Date.now();
                await systemApi.speedTestUpload(uploadData);
                const uploadTime = (Date.now() - uploadStart) / 1000;
                uploadSpeeds.push((uploadBytes * 8) / uploadTime / 1000000);
                await new Promise(r => setTimeout(r, 100));
            }
            uploadSpeeds.sort((a, b) => b - a);
            const bestUploads = uploadSpeeds.slice(0, 2);
            const uploadMbps = (bestUploads.reduce((a, b) => a + b, 0) / bestUploads.length).toFixed(2);

            setSpeedTest({
                running: false,
                latency: avgLatency,
                download: downloadMbps,
                upload: uploadMbps,
                jitter,
                stage: null
            });
        } catch (error) {
            logger.error('Speed test failed:', { error });
            setSpeedTest({ running: false, latency: null, download: null, upload: null, jitter: null, stage: null });
        }
    }, []);

    const handleRefreshDiagnostics = useCallback(async (): Promise<void> => {
        await Promise.all([
            fetchHealthStatus(),
            testApiHealthHandler()
        ]);
    }, [fetchHealthStatus, testApiHealthHandler]);

    // ========================================================================
    // UI Helpers
    // ========================================================================

    const formatUptime = useCallback((seconds: number): string => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);

        return parts.join(' ') || '< 1m';
    }, []);

    const getStatusColor = useCallback((status: HealthStatus): string => {
        if (status === 'healthy') return 'bg-success/20 text-success';
        if (status === 'error') return 'bg-error/20 text-error';
        return 'bg-warning/20 text-warning';
    }, []);

    // ========================================================================
    // Return
    // ========================================================================

    return {
        // System Information
        systemInfo,
        resources,
        loading,
        refreshing,
        handleRefresh,
        formatUptime,

        // Health Status
        sseStatus,
        healthLoading,
        fetchHealthStatus,

        // Database
        dbStatus,
        dbLoading,
        testDatabase,

        // Speed Test
        speedTest,
        runSpeedTest,

        // API Health
        apiHealth,
        apiLoading,
        testApiHealth: testApiHealthHandler,

        // Combined
        handleRefreshDiagnostics,

        // UI Helpers
        getStatusColor
    };
}

/**
 * useDebugSettings Hook
 * 
 * P2 React Query Migration: Uses React Query hooks for server state.
 * Manages debug overlay, log level, and log viewing with auto-refresh.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { systemApi } from '@/api';
import { useDebugConfig, useLogs, useSetLogLevel, useClearLogs, useUpdateDebugConfig } from '../../../api/hooks';
import logger from '../../../utils/logger';
import type { LogLevel, FilterLevel, LogEntry } from '../types';

interface UseDebugSettingsReturn {
    // Debug Overlay
    debugOverlay: boolean;
    handleOverlayToggle: (enabled: boolean) => Promise<void>;

    // Log Level
    logLevel: LogLevel;
    handleLogLevelChange: (newLevel: LogLevel) => Promise<void>;

    // Logs
    logs: LogEntry[];
    filteredLogs: LogEntry[];
    loading: boolean;
    fetchLogs: () => Promise<void>;

    // Log Controls
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filterLevel: FilterLevel;
    setFilterLevel: (level: FilterLevel) => void;
    autoRefresh: boolean;
    setAutoRefresh: (enabled: boolean) => void;

    // Log Actions
    confirmClear: boolean;
    setConfirmClear: (confirm: boolean) => void;
    handleClearLogs: () => Promise<void>;
    handleDownloadLogs: () => Promise<void>;

    // Refs
    logsContainerRef: React.RefObject<HTMLDivElement | null>;
    logsEndRef: React.RefObject<HTMLDivElement | null>;

    // UI Helpers
    getLogLevelColor: (level: string | undefined) => string;
}

export function useDebugSettings(): UseDebugSettingsReturn {
    // =========================================================================
    // P2 React Query: Server State
    // =========================================================================

    // Debug config (overlay + log level)
    const { data: debugConfigData } = useDebugConfig();

    // Update debug config mutation
    const updateDebugConfigMutation = useUpdateDebugConfig();

    // Log level mutation
    const setLogLevelMutation = useSetLogLevel();

    // Clear logs mutation
    const clearLogsMutation = useClearLogs();

    // =========================================================================
    // Local UI State
    // =========================================================================

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterLevel, setFilterLevel] = useState<FilterLevel>('ALL');
    const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
    const [confirmClear, setConfirmClear] = useState<boolean>(false);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const logsContainerRef = useRef<HTMLDivElement>(null);

    // Logs query with polling - controlled by autoRefresh state
    const { data: logs = [], isLoading: loading, refetch: refetchLogs } = useLogs({
        refetchInterval: autoRefresh ? 2000 : false,
    });

    // =========================================================================
    // Derived State from React Query
    // =========================================================================

    // Debug overlay from config
    const debugOverlay = debugConfigData?.config?.debug?.overlayEnabled ?? false;

    // Log level from config
    const logLevel = useMemo((): LogLevel => {
        const savedLevel = debugConfigData?.config?.debug?.logLevel;
        return savedLevel ? (savedLevel.toUpperCase() as LogLevel) : 'INFO';
    }, [debugConfigData]);

    // Filter logs based on search and level
    const filteredLogs = useMemo(() => {
        return logs.filter((log: LogEntry) => {
            const matchesSearch = searchTerm === '' ||
                (log.message && log.message.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel;
            return matchesSearch && matchesLevel;
        });
    }, [logs, searchTerm, filterLevel]);

    // =========================================================================
    // Effects
    // =========================================================================

    // Auto-scroll logs to bottom when new logs arrive
    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // =========================================================================
    // Handlers
    // =========================================================================

    // Handle overlay toggle
    const handleOverlayToggle = useCallback(async (enabled: boolean): Promise<void> => {
        logger.debug('[DEBUG TOGGLE] Toggling overlay to:', enabled);

        try {
            await updateDebugConfigMutation.mutateAsync({
                debug: { overlayEnabled: enabled }
            });
            logger.debug('[DEBUG TOGGLE] Save successful');
            window.location.reload();
        } catch (error) {
            logger.error('Failed to save debug overlay setting:', { error });
        }
    }, [updateDebugConfigMutation]);

    // Handle log level change
    const handleLogLevelChange = useCallback(async (newLevel: LogLevel): Promise<void> => {
        try {
            await setLogLevelMutation.mutateAsync(newLevel);
        } catch (error) {
            logger.error('Failed to update log level:', { error });
        }
    }, [setLogLevelMutation]);

    // Manual refetch logs
    const fetchLogs = useCallback(async (): Promise<void> => {
        await refetchLogs();
    }, [refetchLogs]);

    // Clear logs
    const handleClearLogs = useCallback(async (): Promise<void> => {
        try {
            await clearLogsMutation.mutateAsync();
            setConfirmClear(false);
        } catch (error) {
            logger.error('Failed to clear logs:', { error });
            setConfirmClear(false);
        }
    }, [clearLogsMutation]);

    // Download logs
    const handleDownloadLogs = useCallback(async (): Promise<void> => {
        try {
            const blob = await systemApi.downloadLogs();

            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `framerr-logs-${new Date().toISOString()}.txt`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            logger.error('Failed to download logs:', { error });
        }
    }, []);

    // Get log level color
    const getLogLevelColor = useCallback((level: string | undefined): string => {
        switch (level) {
            case 'ERROR': return 'text-error';
            case 'WARN': return 'text-warning';
            case 'INFO': return 'text-info';
            case 'DEBUG': return 'text-theme-secondary';
            default: return 'text-theme-tertiary';
        }
    }, []);

    return {
        // Debug Overlay
        debugOverlay,
        handleOverlayToggle,

        // Log Level
        logLevel,
        handleLogLevelChange,

        // Logs
        logs,
        filteredLogs,
        loading,
        fetchLogs,

        // Log Controls
        searchTerm,
        setSearchTerm,
        filterLevel,
        setFilterLevel,
        autoRefresh,
        setAutoRefresh,

        // Log Actions
        confirmClear,
        setConfirmClear,
        handleClearLogs,
        handleDownloadLogs,

        // Refs
        logsContainerRef,
        logsEndRef,

        // UI Helpers
        getLogLevelColor
    };
}

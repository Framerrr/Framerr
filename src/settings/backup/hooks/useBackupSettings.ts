import { useState, useEffect, useCallback } from 'react';
import logger from '../../../utils/logger';
import { useRealtimeSSE, BackupEvent } from '../../../hooks/useRealtimeSSE';
import { useNotification } from '../../../hooks/useNotification';
import { backupApi, extractErrorMessage } from '../../../api';
import { useBackupList, useBackupSchedule, useCreateBackup, useDeleteBackup, useUpdateBackupSchedule } from '../../../api/hooks';
import type { BackupInfo, BackupProgress, ScheduleConfig } from '../types';

interface UseBackupSettingsReturn {
    // Backup List
    backups: BackupInfo[];
    totalSize: number;
    isLoading: boolean;
    fetchBackups: () => void;

    // Creating Backup
    isCreating: boolean;
    progress: BackupProgress | null;
    handleCreateBackup: () => Promise<void>;

    // Delete
    deletingFile: string | null;
    handleDelete: (filename: string) => Promise<void>;

    // Download
    handleDownload: (filename: string) => Promise<void>;

    // Messages
    error: string;
    success: string;

    // Schedule
    schedule: ScheduleConfig;
    nextBackupTime: string | null;
    isSavingSchedule: boolean;
    scheduleChanged: boolean;
    handleSaveSchedule: () => Promise<void>;
    handleToggleSchedule: () => Promise<void>;
    updateSchedule: (updates: Partial<ScheduleConfig>) => void;
}

export function useBackupSettings(): UseBackupSettingsReturn {
    // React Query hooks for data fetching
    const backupListQuery = useBackupList();
    const scheduleQuery = useBackupSchedule();
    const createBackupMutation = useCreateBackup();
    const deleteBackupMutation = useDeleteBackup();
    const updateScheduleMutation = useUpdateBackupSchedule();

    // Local UI state (not fetched data)
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [progress, setProgress] = useState<BackupProgress | null>(null);
    const [deletingFile, setDeletingFile] = useState<string | null>(null);
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');

    // Schedule local edit state (for tracking changes before save)
    const [localSchedule, setLocalSchedule] = useState<ScheduleConfig | null>(null);
    const [scheduleChanged, setScheduleChanged] = useState<boolean>(false);
    const [isSavingSchedule, setIsSavingSchedule] = useState<boolean>(false);

    // Sync local schedule with query data
    useEffect(() => {
        if (scheduleQuery.data?.schedule && !scheduleChanged) {
            setLocalSchedule(scheduleQuery.data.schedule as ScheduleConfig);
        }
    }, [scheduleQuery.data?.schedule, scheduleChanged]);

    // Derive values from queries
    const backups = (backupListQuery.data?.backups ?? []) as BackupInfo[];
    const totalSize = backupListQuery.data?.totalSize ?? 0;
    const isLoading = backupListQuery.isLoading;
    const nextBackupTime = scheduleQuery.data?.status.nextBackup ?? null;
    const schedule = localSchedule ?? {
        enabled: true,
        frequency: 'weekly' as const,
        dayOfWeek: 0,
        hour: 3,
        maxBackups: 10
    };

    // Refetch functions for components that need manual refresh
    const fetchBackups = useCallback(() => {
        backupListQuery.refetch();
    }, [backupListQuery]);

    const fetchSchedule = useCallback(() => {
        scheduleQuery.refetch();
        setScheduleChanged(false);
    }, [scheduleQuery]);

    // SSE for real-time progress
    const { onBackupEvent } = useRealtimeSSE();

    // Toast notifications
    const notify = useNotification();

    // Subscribe to backup SSE events
    useEffect(() => {
        const unsubscribe = onBackupEvent((event: BackupEvent) => {
            switch (event.type) {
                case 'started':
                    setIsCreating(true);
                    setProgress({ id: event.data.id, step: 'Starting...', percent: 0 });
                    break;
                case 'progress':
                    setProgress({
                        id: event.data.id,
                        step: event.data.step,
                        percent: event.data.percent
                    });
                    break;
                case 'complete':
                    setIsCreating(false);
                    setProgress(null);
                    setSuccess(`Backup created: ${event.data.filename}`);
                    notify.success('Backup Complete', `Created ${event.data.filename}`);
                    fetchBackups();
                    fetchSchedule(); // Refresh next backup time
                    break;
                case 'error':
                    setIsCreating(false);
                    setProgress(null);
                    setError(`Backup failed: ${event.data.error}`);
                    break;
                case 'scheduled-failed':
                    notify.error('Scheduled Backup Failed', event.data.error);
                    break;
            }
        });

        return unsubscribe;
    }, [onBackupEvent, fetchBackups, fetchSchedule, notify]);

    // Create backup
    const handleCreateBackup = useCallback(async (): Promise<void> => {
        if (isCreating) return;

        setError('');
        setSuccess('');
        setIsCreating(true);
        setProgress({ id: '', step: 'Starting...', percent: 0 });

        try {
            logger.info('[BackupSettings] Creating backup');
            await backupApi.create();
        } catch (err) {
            const message = extractErrorMessage(err);
            setError(message);
            notify.error('Backup Failed', message);
            setIsCreating(false);
            setProgress(null);
            logger.error('[BackupSettings] Backup failed', { error: message });
        }
    }, [isCreating, notify]);

    // Download backup
    const handleDownload = useCallback(async (filename: string): Promise<void> => {
        try {
            logger.info('[BackupSettings] Downloading backup', { filename });

            const blob = await backupApi.download(filename);

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

        } catch (err) {
            logger.error('[BackupSettings] Download failed', { error: err });
            setError('Failed to download backup');
        }
    }, []);

    // Delete backup
    const handleDelete = useCallback(async (filename: string): Promise<void> => {
        setDeletingFile(filename);
        setError('');

        try {
            logger.info('[BackupSettings] Deleting backup', { filename });
            await backupApi.delete(filename);
            setSuccess('Backup deleted');
            notify.success('Backup Deleted', filename);
            fetchBackups();
        } catch (err) {
            const message = extractErrorMessage(err);
            setError(message);
            notify.error('Delete Failed', message);
            logger.error('[BackupSettings] Delete failed', { error: message });
        } finally {
            setDeletingFile(null);
        }
    }, [notify, fetchBackups]);

    // Save schedule
    const handleSaveSchedule = useCallback(async (): Promise<void> => {
        setIsSavingSchedule(true);
        setError('');

        try {
            await updateScheduleMutation.mutateAsync(schedule as Parameters<typeof backupApi.updateSchedule>[0]);

            scheduleQuery.refetch();
            setScheduleChanged(false);
            notify.success('Schedule Saved', schedule.enabled ? 'Scheduled backups enabled' : 'Scheduled backups disabled');
        } catch (err) {
            const message = extractErrorMessage(err);
            setError(message);
        } finally {
            setIsSavingSchedule(false);
        }
    }, [schedule, notify]);

    // Toggle schedule enabled/disabled (saves immediately)
    const handleToggleSchedule = useCallback(async (): Promise<void> => {
        const newEnabled = !schedule.enabled;
        const newSchedule = { ...schedule, enabled: newEnabled };
        setLocalSchedule(newSchedule);

        try {
            const response = await backupApi.updateSchedule(newSchedule as Parameters<typeof backupApi.updateSchedule>[0]);

            scheduleQuery.refetch();
            notify.success(
                newEnabled ? 'Scheduled Backups Enabled' : 'Scheduled Backups Disabled',
                newEnabled ? 'Backups will run automatically' : 'Automatic backups stopped'
            );
        } catch (err) {
            // Revert on error
            setLocalSchedule(schedule);
            const message = extractErrorMessage(err);
            setError(message);
        }
    }, [schedule, notify]);

    // Update schedule field (only for options, not toggle)
    const updateSchedule = useCallback((updates: Partial<ScheduleConfig>) => {
        setLocalSchedule((prev: ScheduleConfig | null) => prev ? { ...prev, ...updates } : null);
        setScheduleChanged(true);
    }, []);

    return {
        // Backup List
        backups,
        totalSize,
        isLoading,
        fetchBackups,

        // Creating Backup
        isCreating,
        progress,
        handleCreateBackup,

        // Delete
        deletingFile,
        handleDelete,

        // Download
        handleDownload,

        // Messages
        error,
        success,

        // Schedule
        schedule,
        nextBackupTime,
        isSavingSchedule,
        scheduleChanged,
        handleSaveSchedule,
        handleToggleSchedule,
        updateSchedule
    };
}

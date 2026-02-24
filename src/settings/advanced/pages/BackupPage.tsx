/**
 * BackupPage - System backup management (Admin only)
 * 
 * Thin orchestrator that composes backup sections.
 * All state management is handled by useBackupSettings hook.
 */

import React from 'react';
import { useBackupSettings } from '../../backup/hooks/useBackupSettings';
import {
    StatsSection,
    CreateBackupSection,
    ScheduleSection,
    BackupListSection,
    BackupInfoSection
} from '../../backup/sections';
import { SettingsPage, SettingsAlert } from '../../../shared/ui/settings';

export const BackupPage = (): React.JSX.Element => {
    const {
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
    } = useBackupSettings();

    return (
        <SettingsPage
            title="Backups"
            description="Create and manage full system backups"
        >
            {/* Stats Header */}
            <StatsSection
                backupCount={backups.length}
                totalSize={totalSize}
                isLoading={isLoading}
                onRefresh={fetchBackups}
            />

            {/* Error/Success Messages */}
            {error && (
                <SettingsAlert type="error">{error}</SettingsAlert>
            )}
            {success && (
                <SettingsAlert type="success">{success}</SettingsAlert>
            )}

            {/* Create Manual Backup */}
            <CreateBackupSection
                isCreating={isCreating}
                progress={progress}
                onCreateBackup={handleCreateBackup}
            />

            {/* Scheduled Backups */}
            <ScheduleSection
                schedule={schedule}
                nextBackupTime={nextBackupTime}
                isSavingSchedule={isSavingSchedule}
                scheduleChanged={scheduleChanged}
                onSaveSchedule={handleSaveSchedule}
                onToggleSchedule={handleToggleSchedule}
                onUpdateSchedule={updateSchedule}
            />

            {/* Backup List */}
            <BackupListSection
                backups={backups}
                isLoading={isLoading}
                deletingFile={deletingFile}
                onDelete={handleDelete}
                onDownload={handleDownload}
            />

            {/* Backup Info */}
            <BackupInfoSection />
        </SettingsPage>
    );
};

export default BackupPage;

/**
 * Backup API Endpoints
 * Backup creation, management, and scheduling
 */
import { api, apiClient } from '../client';

// Types — BackupInfo is the shared single source of truth
import type { BackupInfo } from '../../../shared/types/backup';
export type { BackupInfo } from '../../../shared/types/backup';

export interface BackupListResponse {
    backups: BackupInfo[];
    totalSize: number;
    count: number;
}

export interface ScheduleConfig {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    hour: number;
    maxBackups: number;
}

export interface ScheduleResponse {
    success: boolean;
    schedule: ScheduleConfig;
    status: {
        nextBackup: string | null;
        isRunning: boolean;
    };
}

// Endpoints
export const backupApi = {
    /**
     * Get list of all backups
     */
    list: () =>
        api.get<BackupListResponse>('/api/backup/list'),

    /**
     * Create a new backup
     */
    create: () =>
        api.post<void>('/api/backup/create'),

    /**
     * Delete a backup by filename
     */
    delete: (filename: string) =>
        api.delete<void>(`/api/backup/${filename}`),

    /**
     * Download a backup file
     * Returns a Blob for file download
     */
    download: async (filename: string): Promise<Blob> => {
        const response = await apiClient.get(`/api/backup/download/${filename}`, {
            responseType: 'blob'
        });
        return response.data;
    },

    /**
     * Get backup schedule configuration
     */
    getSchedule: () =>
        api.get<ScheduleResponse>('/api/backup/schedule'),

    /**
     * Update backup schedule configuration
     */
    updateSchedule: (config: ScheduleConfig) =>
        api.put<ScheduleResponse>('/api/backup/schedule', config),

    /**
     * Encryption management endpoints (admin only)
     */
    encryption: {
        getStatus: () =>
            api.get<{ enabled: boolean }>('/api/backup/encryption/status'),

        enable: (password: string) =>
            api.post<{ enabled: true; message: string }>('/api/backup/encryption/enable', { password }),

        disable: (password: string) =>
            api.post<{ enabled: false; message: string }>('/api/backup/encryption/disable', { password }),

        changePassword: (oldPassword: string, newPassword: string) =>
            api.post<{ message: string; rewriteErrors?: string[] }>('/api/backup/encryption/change-password', { oldPassword, newPassword }),
    },
};

export default backupApi;

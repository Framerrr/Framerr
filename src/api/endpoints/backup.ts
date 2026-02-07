/**
 * Backup API Endpoints
 * Backup creation, management, and scheduling
 */
import { api, apiClient } from '../client';

// Types
export interface BackupInfo {
    filename: string;
    size: number;
    createdAt: string;
    isScheduled?: boolean;
}

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
};

export default backupApi;

// Backup Settings Types

export interface BackupInfo {
    filename: string;
    type: 'manual' | 'scheduled' | 'safety';
    size: number;
    createdAt: string;
}

export interface BackupProgress {
    id: string;
    step: string;
    percent: number;
}

export interface ScheduleConfig {
    enabled: boolean;
    frequency: 'daily' | 'weekly';
    dayOfWeek?: number;
    hour: number;
    maxBackups: number;
    lastBackup?: string;
    nextBackup?: string;
}

export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

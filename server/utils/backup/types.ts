/**
 * Backup Module — Types
 *
 * Type and interface definitions for the backup system.
 */

export interface BackupOptions {
    saveToServer?: boolean;
    type?: 'manual' | 'scheduled' | 'safety';
}

export interface BackupResult {
    stream?: import('stream').Readable;
    filename: string;
    size: number;
    savedToServer: boolean;
    encrypted: boolean;
}

// BackupInfo is imported from shared types (single source of truth)
export type { BackupInfo } from '../../../shared/types/backup';

export interface BackupProgress {
    id: string;
    step: string;
    percent: number;
}

export interface RestoreValidationResult {
    valid: boolean;
    error?: string;
    manifest?: {
        version: string;
        type: string;
        createdAt: string;
        assets: {
            profilePictures: boolean;
            customIcons: boolean;
            favicon: boolean;
        };
    };
}

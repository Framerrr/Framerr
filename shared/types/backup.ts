/**
 * Shared Backup Types
 *
 * Single source of truth for backup-related types.
 * Used by both frontend and backend.
 */

export interface BackupInfo {
    filename: string;
    size: number;
    createdAt: string;
    type: 'manual' | 'scheduled' | 'safety';
    encrypted: boolean;
}

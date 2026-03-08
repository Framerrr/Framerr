/**
 * Backup Module — Barrel
 *
 * Re-exports all public symbols from the backup subsystem.
 * Consumers import from '../utils/backup' which resolves to this index.
 */

// Types
export type { BackupOptions, BackupResult, BackupProgress, RestoreValidationResult } from './types';
export type { BackupInfo } from './types';

// Constants
export { BACKUPS_DIR } from './constants';

// Progress / status
export { isBackupInProgress, getCurrentBackupId } from './progress';

// Storage
export { listBackups, getBackupFilePath, deleteBackup, getBackupsTotalSize, cleanupOldBackups } from './storage';

// Creation
export { createBackup } from './creation';

// Restore
export { validateBackupZip, extractBackup } from './restore';

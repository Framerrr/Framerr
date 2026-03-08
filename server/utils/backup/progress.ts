/**
 * Backup Module — Progress Broadcasting
 *
 * SSE progress broadcasting and in-progress state tracking.
 * This module is the single owner of `currentBackupId` state.
 */

import { broadcast } from '../../services/sseStreamService';

// ============================================================================
// State (single owner)
// ============================================================================

let currentBackupId: string | null = null;

// ============================================================================
// State Accessors
// ============================================================================

/**
 * Set current backup ID. Called by creation.ts at start and end of createBackup().
 */
export function setCurrentBackupId(id: string | null): void {
    currentBackupId = id;
}

/**
 * Check if a backup is currently in progress
 */
export function isBackupInProgress(): boolean {
    return currentBackupId !== null;
}

/**
 * Get current backup ID if one is in progress
 */
export function getCurrentBackupId(): string | null {
    return currentBackupId;
}

/**
 * Generate a unique backup ID
 */
export function generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// SSE Broadcasting
// ============================================================================

export function broadcastProgress(id: string, step: string, percent: number): void {
    broadcast('backup:progress', { id, step, percent });
}

export function broadcastComplete(id: string, filename: string, size: number): void {
    broadcast('backup:complete', { id, filename, size });
}

export function broadcastError(id: string, error: string): void {
    broadcast('backup:error', { id, error });
}

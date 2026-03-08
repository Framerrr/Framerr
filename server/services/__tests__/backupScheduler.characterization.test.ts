/**
 * Characterization Tests for server/services/backupScheduler.ts
 *
 * These tests lock the behavior of the backup scheduler AFTER the
 * backup utility split. They verify that executeScheduledBackup():
 * - calls createBackup with correct options
 * - handles success: runs cleanup and updates last backup time
 * - handles failure: broadcasts 'backup:scheduled-failed' event
 * - guards against concurrent execution via isRunning flag
 *
 * TASK-20260306-007 / S-X4-01 Behavior Lock — Preserve Item #2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock Setup (before imports) ---

// Mock logger
vi.mock('../../utils/logger', () => ({
    default: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock backup utilities
vi.mock('../../utils/backup', () => ({
    createBackup: vi.fn(),
    cleanupOldBackups: vi.fn(() => 0),
}));

// Mock system config
vi.mock('../../db/systemConfig', () => ({
    getSystemConfig: vi.fn(),
    updateSystemConfig: vi.fn(),
}));

// Mock SSE
vi.mock('../sseStreamService', () => ({
    broadcast: vi.fn(),
}));

// Mock job scheduler
vi.mock('../jobScheduler', () => ({
    registerJob: vi.fn(),
    unregisterJob: vi.fn(),
    getJobStatus: vi.fn(),
}));

// --- Imports (after mocks) ---
import { executeScheduledBackup } from '../backupScheduler';
import { createBackup, cleanupOldBackups } from '../../utils/backup';
import { getSystemConfig, updateSystemConfig } from '../../db/systemConfig';
import { broadcast } from '../sseStreamService';

// ============================================================================
// executeScheduledBackup
// ============================================================================

describe('Characterization: executeScheduledBackup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls createBackup with saveToServer=true and type=scheduled', async () => {
        vi.mocked(createBackup).mockResolvedValue({
            filename: 'framerr-scheduled-2026-03-06T03-00-00.zip',
            size: 1024,
            savedToServer: true,
            encrypted: false,
        });
        vi.mocked(getSystemConfig).mockResolvedValue({
            backupSchedule: {
                enabled: true,
                frequency: 'daily',
                hour: 3,
                maxBackups: 5,
            },
        } as Awaited<ReturnType<typeof getSystemConfig>>);

        await executeScheduledBackup();

        expect(createBackup).toHaveBeenCalledWith({
            saveToServer: true,
            type: 'scheduled',
        });
    });

    it('runs cleanup and updates last backup time on success', async () => {
        vi.mocked(createBackup).mockResolvedValue({
            filename: 'framerr-scheduled-2026-03-06T03-00-00.zip',
            size: 1024,
            savedToServer: true,
            encrypted: false,
        });
        vi.mocked(getSystemConfig).mockResolvedValue({
            backupSchedule: {
                enabled: true,
                frequency: 'daily',
                hour: 3,
                maxBackups: 5,
            },
        } as Awaited<ReturnType<typeof getSystemConfig>>);
        vi.mocked(cleanupOldBackups).mockReturnValue(2);

        await executeScheduledBackup();

        expect(cleanupOldBackups).toHaveBeenCalledWith(5);
        expect(updateSystemConfig).toHaveBeenCalledWith(
            expect.objectContaining({
                backupSchedule: expect.objectContaining({
                    lastBackup: expect.any(String),
                }),
            })
        );
    });

    it('broadcasts backup:scheduled-failed on error', async () => {
        vi.mocked(createBackup).mockRejectedValue(new Error('Test failure'));

        await executeScheduledBackup();

        expect(broadcast).toHaveBeenCalledWith('backup:scheduled-failed', {
            error: 'Test failure',
            timestamp: expect.any(String),
        });
    });

    it('skips execution if already running (isRunning guard)', async () => {
        // Start a long-running backup
        let resolveBackup: (value: unknown) => void;
        const backupPromise = new Promise((resolve) => {
            resolveBackup = resolve;
        });
        vi.mocked(createBackup).mockReturnValue(backupPromise as ReturnType<typeof createBackup>);
        vi.mocked(getSystemConfig).mockResolvedValue({
            backupSchedule: { enabled: true, frequency: 'daily', hour: 3, maxBackups: 5 },
        } as Awaited<ReturnType<typeof getSystemConfig>>);

        // Start first execution (won't complete yet)
        const firstRun = executeScheduledBackup();

        // Start second execution — should skip
        await executeScheduledBackup();

        // createBackup should have been called only once (first run)
        expect(createBackup).toHaveBeenCalledTimes(1);

        // Clean up: resolve the first run
        resolveBackup!({
            filename: 'test.zip',
            size: 100,
            savedToServer: true,
            encrypted: false,
        });
        await firstRun;
    });
});

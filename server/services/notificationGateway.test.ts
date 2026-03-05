/**
 * Notification Gateway — Characterization Tests
 *
 * Behavior lock: verifies pass-through semantics and validation logic
 * before any producer migration occurs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB layer BEFORE importing the gateway
vi.mock('../db/notifications', () => ({
    createNotification: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
    default: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { produceNotification } from './notificationGateway';
import { createNotification } from '../db/notifications';
import logger from '../utils/logger';

const mockedCreateNotification = vi.mocked(createNotification);
const mockedLogger = vi.mocked(logger);

describe('notificationGateway', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('pass-through behavior', () => {
        it('calls createNotification with identical arguments and returns the same result', async () => {
            const inputData = {
                userId: 'user-123',
                type: 'info' as const,
                title: 'Test notification',
                message: 'This is a test',
                iconId: 'test-icon',
                metadata: { key: 'value' },
            };

            const expectedResult = {
                id: 'notif-456',
                userId: 'user-123',
                type: 'info' as const,
                title: 'Test notification',
                message: 'This is a test',
                iconId: 'test-icon',
                iconIds: null,
                read: false,
                metadata: { key: 'value' },
                createdAt: '2026-03-04T00:00:00.000Z',
                expiresAt: null,
            };

            mockedCreateNotification.mockResolvedValue(expectedResult);

            const result = await produceNotification(inputData, 'api');

            expect(mockedCreateNotification).toHaveBeenCalledWith(inputData);
            expect(result).toBe(expectedResult);
        });

        it('accepts empty-string message (actions.ts use case)', async () => {
            const inputData = {
                userId: 'user-123',
                type: 'info' as const,
                title: 'Maintenance toggle',
                message: '',
            };

            const expectedResult = {
                id: 'notif-789',
                userId: 'user-123',
                type: 'info' as const,
                title: 'Maintenance toggle',
                message: '',
                iconId: null,
                iconIds: null,
                read: false,
                metadata: null,
                createdAt: '2026-03-04T00:00:00.000Z',
                expiresAt: null,
            };

            mockedCreateNotification.mockResolvedValue(expectedResult);

            const result = await produceNotification(inputData, 'service-monitor');

            expect(mockedCreateNotification).toHaveBeenCalledWith(inputData);
            expect(result).toBe(expectedResult);
        });
    });

    describe('validation', () => {
        it('rejects missing userId', async () => {
            const data = {
                userId: '',
                title: 'Test',
                message: 'Test',
            };

            await expect(produceNotification(data, 'api')).rejects.toThrow('Notification missing userId');
            expect(mockedCreateNotification).not.toHaveBeenCalled();
        });

        it('rejects missing title', async () => {
            const data = {
                userId: 'user-123',
                title: '',
                message: 'Test',
            };

            await expect(produceNotification(data, 'api')).rejects.toThrow('Notification missing title');
            expect(mockedCreateNotification).not.toHaveBeenCalled();
        });

        it('rejects invalid notification type', async () => {
            const data = {
                userId: 'user-123',
                type: 'invalid' as 'info',
                title: 'Test',
                message: 'Test',
            };

            await expect(produceNotification(data, 'api')).rejects.toThrow('Invalid notification type');
            expect(mockedCreateNotification).not.toHaveBeenCalled();
        });

        it('allows undefined type (defaults handled by createNotification)', async () => {
            const data = {
                userId: 'user-123',
                title: 'Test',
                message: 'Test',
            };

            mockedCreateNotification.mockResolvedValue({
                id: 'notif-000',
                userId: 'user-123',
                type: 'info',
                title: 'Test',
                message: 'Test',
                iconId: null,
                iconIds: null,
                read: false,
                metadata: null,
                createdAt: '2026-03-04T00:00:00.000Z',
                expiresAt: null,
            });

            await produceNotification(data, 'webhook');

            expect(mockedCreateNotification).toHaveBeenCalledWith(data);
        });
    });

    describe('source logging', () => {
        it('logs source tag in debug output', async () => {
            const data = {
                userId: 'user-123',
                type: 'success' as const,
                title: 'Test',
                message: 'Test message',
            };

            mockedCreateNotification.mockResolvedValue({
                id: 'notif-111',
                userId: 'user-123',
                type: 'success',
                title: 'Test',
                message: 'Test message',
                iconId: null,
                iconIds: null,
                read: false,
                metadata: null,
                createdAt: '2026-03-04T00:00:00.000Z',
                expiresAt: null,
            });

            await produceNotification(data, 'template-sharing');

            expect(mockedLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('source=template-sharing')
            );
        });
    });
});

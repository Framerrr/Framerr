/**
 * Route tests for POST /api/realtime/retry
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';

const {
    mockTriggerPoll,
    mockSupportsPolling,
    mockGetInstanceById,
    mockUserHasIntegrationAccess,
    mockClientConnections,
} = vi.hoisted(() => {
    const connections = new Map<string, {
        userId: string;
        subscriptions: Set<string>;
    }>();
    return {
        mockTriggerPoll: vi.fn().mockResolvedValue(undefined),
        mockSupportsPolling: vi.fn(),
        mockGetInstanceById: vi.fn(),
        mockUserHasIntegrationAccess: vi.fn(),
        mockClientConnections: connections,
    };
});

vi.mock('../../services/sseStreamService', () => ({
    addClient: vi.fn(),
    removeClient: vi.fn(),
    addClientConnection: vi.fn(() => 'conn-1'),
    removeClientConnection: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getActiveTopics: vi.fn(() => []),
    getSubscriberCount: vi.fn(() => 0),
}));

vi.mock('../../services/sse/connections', () => ({
    clientConnections: mockClientConnections,
    setPushEndpoint: vi.fn(),
}));

vi.mock('../../services/sse/PollerOrchestrator', () => ({
    pollerOrchestrator: {
        triggerPoll: (...args: unknown[]) => mockTriggerPoll(...args),
        supportsPolling: (...args: unknown[]) => mockSupportsPolling(...args),
    },
    parseTopic: (topic: string) => {
        const parts = topic.split(':');
        if (parts.length === 2) {
            return { type: parts[0], instanceId: parts[1] };
        }
        if (parts.length === 3) {
            return { type: parts[0], subtype: parts[1], instanceId: parts[2] };
        }
        return { type: parts[0], instanceId: undefined };
    },
}));

vi.mock('../../db/integrationInstances', () => ({
    getInstanceById: (...args: unknown[]) => mockGetInstanceById(...args),
}));

vi.mock('../../db/integrationShares', () => ({
    userHasIntegrationAccess: (...args: unknown[]) => mockUserHasIntegrationAccess(...args),
}));

vi.mock('../../utils/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../middleware/auth', () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import realtimeRouter from '../realtime';

function createTestApp(userOverrides: Partial<{ id: string; group: string }> = {}) {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: () => void) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).user = {
            id: 'user-1',
            group: 'user',
            ...userOverrides,
        };
        next();
    });
    app.use('/api/realtime', realtimeRouter);
    return app;
}

const VALID_TOPIC = 'radarr:inst-abc';
const CONNECTION_ID = 'conn-owned';

beforeEach(() => {
    vi.clearAllMocks();
    mockClientConnections.clear();
    mockClientConnections.set(CONNECTION_ID, {
        userId: 'user-1',
        subscriptions: new Set([VALID_TOPIC]),
    });
    mockSupportsPolling.mockReturnValue(true);
    mockGetInstanceById.mockReturnValue({ id: 'inst-abc', type: 'radarr' });
    mockUserHasIntegrationAccess.mockReturnValue(true);
});

describe('POST /api/realtime/retry', () => {
    it('returns 403 when caller lacks integration access', async () => {
        mockUserHasIntegrationAccess.mockReturnValue(false);

        const res = await request(createTestApp())
            .post('/api/realtime/retry')
            .send({ connectionId: CONNECTION_ID, topic: VALID_TOPIC });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied for this integration');
        expect(mockTriggerPoll).not.toHaveBeenCalled();
    });

    it('returns 403 when topic instance is not found in DB', async () => {
        mockGetInstanceById.mockReturnValue(null);

        const res = await request(createTestApp())
            .post('/api/realtime/retry')
            .send({ connectionId: CONNECTION_ID, topic: VALID_TOPIC });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Integration not found for topic');
        expect(mockTriggerPoll).not.toHaveBeenCalled();
    });

    it('returns 400 for non-pollable topics (e.g. plex)', async () => {
        mockSupportsPolling.mockReturnValue(false);

        const res = await request(createTestApp())
            .post('/api/realtime/retry')
            .send({ connectionId: CONNECTION_ID, topic: 'plex:inst-1' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Topic does not support on-demand retry');
        expect(mockTriggerPoll).not.toHaveBeenCalled();
    });

    it('triggers poll when caller has valid share and subscription', async () => {
        const res = await request(createTestApp())
            .post('/api/realtime/retry')
            .send({ connectionId: CONNECTION_ID, topic: VALID_TOPIC });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, topic: VALID_TOPIC, burstCount: 5 });
        expect(mockTriggerPoll).toHaveBeenCalledWith(VALID_TOPIC);
        expect(mockUserHasIntegrationAccess).toHaveBeenCalledWith('radarr', 'user-1', 'user');
    });
});

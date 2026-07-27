/**
 * useDnsStatsData — client-side pause countdown ticker
 * TASK-20260726-002
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DnsStatsData } from '../api.types';
import type { UseIntegrationSSEOptions } from '../../../shared/widgets/hooks/useIntegrationSSE';

const sseCallbacks: { onData?: (data: DnsStatsData) => void } = {};

vi.mock('../../../shared/widgets', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../shared/widgets')>();
    return {
        ...actual,
        useIntegrationSSE: (opts: UseIntegrationSSEOptions<DnsStatsData>) => {
            sseCallbacks.onData = opts.onData;
            return {
                loading: false,
                connectionId: null,
                isSubscribed: true,
                isConnected: true,
                isUnavailable: false,
                isConfigError: false,
                isAuthError: false,
            };
        },
    };
});

vi.mock('../../../context/notification', () => ({
    useToasts: () => ({
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        showToast: vi.fn(),
        toasts: [],
        dismissToast: vi.fn(),
    }),
}));

vi.mock('../../../api/client', () => ({
    default: {
        post: vi.fn().mockResolvedValue({}),
    },
}));

import { useDnsStatsData } from '../hooks/useDnsStatsData';

function basePausedData(pauseRemaining: number): DnsStatsData {
    return {
        queriesTotal: 100,
        queriesBlocked: 10,
        blockedPercent: 10,
        domainsOnList: 50,
        protectionEnabled: false,
        pauseRemaining,
        avgProcessingTimeMs: null,
        activeClients: null,
        topBlockedDomains: [],
        topQueriedDomains: [],
        topClients: [],
        topUpstreams: [],
        sparkline: [],
    };
}

describe('useDnsStatsData pause countdown', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        sseCallbacks.onData = undefined;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('ticks pauseRemaining every second, floors at 0, and resyncs on new SSE', async () => {
        const { result } = renderHook(() =>
            useDnsStatsData({
                integrationType: 'adguard',
                integrationId: 'adguard-1',
                enabled: true,
            }),
        );

        await act(async () => {
            sseCallbacks.onData?.(basePausedData(5));
        });

        expect(result.current.data?.pauseRemaining).toBe(5);

        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current.data?.pauseRemaining).toBe(4);

        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current.data?.pauseRemaining).toBe(3);

        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current.data?.pauseRemaining).toBe(2);

        await act(async () => {
            vi.advanceTimersByTime(5000);
        });
        expect(result.current.data?.pauseRemaining).toBe(0);

        await act(async () => {
            sseCallbacks.onData?.(basePausedData(30));
        });
        expect(result.current.data?.pauseRemaining).toBe(30);

        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current.data?.pauseRemaining).toBe(29);
    });
});

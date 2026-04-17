/**
 * useRealtimeSSE — Snapshot return pattern (BL-4c)
 *
 * TASK-20260316-001 / REMEDIATION-2026-P7 / S-T-LINT-03c
 *
 * Characterization test: useTopicSubscription returns dataRef.current,
 * a render-time snapshot. Verifies the data snapshot pattern works
 * correctly even with suppression comments.
 *
 * Key behavior under test (useRealtimeSSE.ts lines 160-175):
 *   - dataRef stores subscription data written by the effect callback
 *   - useTopicSubscription returns dataRef.current (render-time snapshot)
 *   - When the subscription callback fires, dataRef.current is updated
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — capture the subscription callback so we can simulate data arrival
// ---------------------------------------------------------------------------

type TopicCallback = (data: unknown) => void;
let capturedCallback: TopicCallback | null = null;

const mockSubscribeToTopic = vi.fn((topic: string, cb: TopicCallback) => {
    capturedCallback = cb;
    return Promise.resolve(() => { capturedCallback = null; });
});

// useSyncExternalStore requires getSnapshot to return a stable reference
const stableSnapshot = {
    isConnected: true,
    connectionId: 'conn-1',
    disconnectedAt: null,
};

vi.mock('../../features/realtime', () => ({
    subscribeToStore: (cb: () => void) => {
        return () => { };
    },
    getSnapshot: () => stableSnapshot,
    subscribeToTopicInternal: (...args: unknown[]) => mockSubscribeToTopic(...args as [string, TopicCallback]),
    serviceStatusCallbacks: new Set(),
    backupCallbacks: new Set(),
    notificationCallbacks: new Set(),
    settingsInvalidateCallbacks: new Set(),
    themeCallbacks: new Set(),
    librarySyncProgressCallbacks: new Set(),
}));

import { useTopicSubscription } from '../useRealtimeSSE';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BL-4c: useTopicSubscription — snapshot return pattern', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedCallback = null;
    });

    it('returns null before any data arrives (dataRef.current initial value)', () => {
        const { result } = renderHook(() =>
            useTopicSubscription<{ count: number }>('test-topic')
        );

        // dataRef.current starts as null
        expect(result.current).toBeNull();
    });

    it('subscribes to the topic and captures callback for data delivery', async () => {
        renderHook(() =>
            useTopicSubscription<{ count: number }>('test-topic')
        );

        // Wait for the async subscription to be established
        await act(async () => {
            await vi.waitFor(() => expect(mockSubscribeToTopic).toHaveBeenCalledWith(
                'test-topic',
                expect.any(Function)
            ));
        });

        // The subscription callback should have been captured
        expect(capturedCallback).not.toBeNull();
    });

    it('returns updated dataRef.current after subscription callback fires', async () => {
        const { result, rerender } = renderHook(() =>
            useTopicSubscription<{ count: number }>('test-topic')
        );

        // Wait for subscription
        await act(async () => {
            await vi.waitFor(() => expect(capturedCallback).not.toBeNull());
        });

        // Simulate data arrival via the captured subscription callback
        // This writes to dataRef.current inside the hook
        act(() => {
            capturedCallback!({ count: 42 });
        });

        // Re-render to read the updated dataRef.current (snapshot return)
        rerender();

        // The hook should now return the data that was written to dataRef.current
        expect(result.current).toEqual({ count: 42 });
    });

    it('does not subscribe when topic is null', () => {
        renderHook(() => useTopicSubscription(null));
        expect(mockSubscribeToTopic).not.toHaveBeenCalled();
    });
});

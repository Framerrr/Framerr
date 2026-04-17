/**
 * useMultiIntegrationSSE — Latest-callback timing (BL-4b)
 *
 * TASK-20260316-001 / REMEDIATION-2026-P7 / S-T-LINT-03c
 *
 * Characterization test: verifies latest onData callback fires for
 * multi-instance subscriptions. Proves the onDataRef pattern works
 * correctly even with suppression comments.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type TopicCallback = (data: unknown) => void;
const capturedCallbacks = new Map<string, TopicCallback>();

const mockSubscribeToTopic = vi.fn((topic: string, cb: TopicCallback) => {
    capturedCallbacks.set(topic, cb);
    return Promise.resolve(() => { capturedCallbacks.delete(topic); });
});

vi.mock('../../../../hooks/useRealtimeSSE', () => ({
    default: () => ({
        subscribeToTopic: mockSubscribeToTopic,
        connectionId: 'conn-1',
        isConnected: true,
    }),
}));

vi.mock('../../../../utils/logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import useMultiIntegrationSSE from '../useMultiIntegrationSSE';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BL-4b: useMultiIntegrationSSE — latest callback timing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedCallbacks.clear();
    });

    it('fires the LATEST onData callback when data arrives after callback update', async () => {
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        const { rerender } = renderHook(
            ({ onData }) =>
                useMultiIntegrationSSE({
                    integrationType: 'sonarr',
                    subtype: 'queue',
                    integrationIds: ['sonarr-1'],
                    onData,
                    enabled: true,
                }),
            { initialProps: { onData: firstCallback } }
        );

        // Wait for subscriptions to resolve
        await act(async () => {
            await vi.waitFor(() => expect(capturedCallbacks.size).toBeGreaterThan(0));
        });

        // Update callback
        rerender({ onData: secondCallback });

        // Simulate data arrival
        const cb = capturedCallbacks.get('sonarr:queue:sonarr-1');
        expect(cb).toBeDefined();
        act(() => cb!({ queue: [] }));

        // Latest (second) callback should fire
        expect(secondCallback).toHaveBeenCalledWith('sonarr-1', { queue: [] });
        expect(firstCallback).not.toHaveBeenCalled();
    });

    it('does not subscribe when enabled=false', () => {
        const onData = vi.fn();

        renderHook(() =>
            useMultiIntegrationSSE({
                integrationType: 'sonarr',
                subtype: 'queue',
                integrationIds: ['sonarr-1'],
                onData,
                enabled: false,
            })
        );

        expect(mockSubscribeToTopic).not.toHaveBeenCalled();
    });

    it('does not subscribe when integrationIds is empty', () => {
        const onData = vi.fn();

        renderHook(() =>
            useMultiIntegrationSSE({
                integrationType: 'sonarr',
                subtype: 'queue',
                integrationIds: [],
                onData,
                enabled: true,
            })
        );

        expect(mockSubscribeToTopic).not.toHaveBeenCalled();
    });
});

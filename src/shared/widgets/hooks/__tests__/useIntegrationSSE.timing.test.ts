/**
 * useIntegrationSSE — Latest-callback timing (BL-4a)
 *
 * TASK-20260316-001 / REMEDIATION-2026-P7 / S-T-LINT-03c
 *
 * Characterization test: verifies that the latest onData callback fires
 * when data arrives (not a stale closure). Proves the onDataRef pattern
 * works correctly even with suppression comments.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type TopicCallback = (data: unknown) => void;
let capturedCallback: TopicCallback | null = null;

const mockSubscribeToTopic = vi.fn((topic: string, cb: TopicCallback) => {
    capturedCallback = cb;
    return Promise.resolve(() => { capturedCallback = null; });
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

import { useIntegrationSSE } from '../useIntegrationSSE';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BL-4a: useIntegrationSSE — latest callback timing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedCallback = null;
    });

    it('fires the LATEST onData callback when data arrives after callback update', async () => {
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        const { rerender } = renderHook(
            ({ onData }) =>
                useIntegrationSSE({
                    integrationType: 'plex',
                    integrationId: 'plex-1',
                    onData,
                }),
            { initialProps: { onData: firstCallback } }
        );

        // Wait for subscription promise to resolve
        await act(async () => {
            await vi.waitFor(() => expect(capturedCallback).not.toBeNull());
        });

        // Update callback via rerender
        rerender({ onData: secondCallback });

        // Simulate data arrival after callback update
        act(() => {
            capturedCallback!({ sessions: [] });
        });

        // The SECOND (latest) callback should fire, not the first
        expect(secondCallback).toHaveBeenCalledWith({ sessions: [] });
        expect(firstCallback).not.toHaveBeenCalled();
    });

    it('does not subscribe when integrationId is undefined', () => {
        const onData = vi.fn();

        renderHook(() =>
            useIntegrationSSE({
                integrationType: 'plex',
                integrationId: undefined,
                onData,
            })
        );

        expect(mockSubscribeToTopic).not.toHaveBeenCalled();
    });

    it('does not subscribe when enabled is false', () => {
        const onData = vi.fn();

        renderHook(() =>
            useIntegrationSSE({
                integrationType: 'plex',
                integrationId: 'plex-1',
                onData,
                enabled: false,
            })
        );

        expect(mockSubscribeToTopic).not.toHaveBeenCalled();
    });
});

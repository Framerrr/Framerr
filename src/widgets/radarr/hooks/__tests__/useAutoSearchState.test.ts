/**
 * useAutoSearchState — stateRef timing (BL-W0-9)
 *
 * TASK-20260722-001 / REMEDIATION-2026-P7 / S-T-LINT-04
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSearchState } from '../useAutoSearchState';

describe('BL-W0-9: useAutoSearchState stateRef timing', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('trigger ignores a second call while searching after stateRef syncs', async () => {
        const action = vi.fn().mockResolvedValue(true);
        const { result } = renderHook(() =>
            useAutoSearchState({
                minSearchingDurationMs: 100,
                successDurationMs: 50,
                errorDurationMs: 50,
            }),
        );

        await act(async () => {
            void result.current.trigger(action);
        });
        expect(result.current.state).toBe('searching');

        await act(async () => {
            void result.current.trigger(action);
        });
        expect(action).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(result.current.state).toBe('success');
    });
});

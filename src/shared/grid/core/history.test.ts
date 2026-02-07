/**
 * Grid Core History - Unit Tests
 *
 * Tests for the shared undo/redo hook with multi-stack support.
 * Run with: npm run test:run -- src/shared/grid/core/history.test.ts
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutHistory, MAX_HISTORY_SIZE } from './history';
import type { HistorySnapshot, HistoryStackName } from './types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createSnapshot = (id: string): HistorySnapshot => ({
    widgets: [
        { id: `widget-${id}`, type: 'clock', layout: { x: 0, y: 0, w: 4, h: 2 }, config: {} },
    ],
});

// ============================================================================
// TESTS
// ============================================================================

describe('useLayoutHistory (multi-stack)', () => {
    const DESKTOP: HistoryStackName = 'desktop';
    const MOBILE: HistoryStackName = 'mobile';

    describe('initial state', () => {
        it('starts with empty stacks', () => {
            const { result } = renderHook(() => useLayoutHistory());

            expect(result.current.canUndo(DESKTOP)).toBe(false);
            expect(result.current.canRedo(DESKTOP)).toBe(false);
            expect(result.current.canUndo(MOBILE)).toBe(false);
            expect(result.current.canRedo(MOBILE)).toBe(false);
        });
    });

    describe('push', () => {
        it('adds snapshot to specified stack (desktop)', () => {
            const { result } = renderHook(() => useLayoutHistory());
            const snapshot = createSnapshot('1');

            act(() => {
                result.current.push(DESKTOP, snapshot);
            });

            expect(result.current.canUndo(DESKTOP)).toBe(true);
            expect(result.current.canUndo(MOBILE)).toBe(false);
        });

        it('adds snapshot to specified stack (mobile)', () => {
            const { result } = renderHook(() => useLayoutHistory());
            const snapshot = createSnapshot('1');

            act(() => {
                result.current.push(MOBILE, snapshot);
            });

            expect(result.current.canUndo(MOBILE)).toBe(true);
            expect(result.current.canUndo(DESKTOP)).toBe(false);
        });

        it('clears redo stack on new push', async () => {
            const { result } = renderHook(() => useLayoutHistory());

            // Push initial state
            act(() => {
                result.current.push(DESKTOP, createSnapshot('1'));
            });

            expect(result.current.canUndo(DESKTOP)).toBe(true);

            // Add item to redo stack directly
            act(() => {
                result.current.pushToRedo(DESKTOP, createSnapshot('current'));
            });

            expect(result.current.canRedo(DESKTOP)).toBe(true);

            // Wait for any async cleanup
            await new Promise(resolve => setTimeout(resolve, 10));

            // Push new action - should clear redo
            act(() => {
                result.current.push(DESKTOP, createSnapshot('2'));
            });

            expect(result.current.canRedo(DESKTOP)).toBe(false);
        });

        it('trims stack when exceeding max size', () => {
            const { result } = renderHook(() => useLayoutHistory());

            // Push more than MAX_HISTORY_SIZE snapshots
            act(() => {
                for (let i = 0; i < MAX_HISTORY_SIZE + 10; i++) {
                    result.current.push(DESKTOP, createSnapshot(`${i}`));
                }
            });

            // Undo MAX_HISTORY_SIZE times should work
            let undoCount = 0;
            while (result.current.canUndo(DESKTOP)) {
                act(() => {
                    result.current.pushToRedo(DESKTOP, createSnapshot('current'));
                    result.current.undo(DESKTOP);
                });
                undoCount++;
                if (undoCount > MAX_HISTORY_SIZE + 5) break; // Safety
            }

            expect(undoCount).toBe(MAX_HISTORY_SIZE);
        });
    });

    describe('undo', () => {
        it('returns null when stack is empty', () => {
            const { result } = renderHook(() => useLayoutHistory());

            let returned: HistorySnapshot | null = null;
            act(() => {
                returned = result.current.undo(DESKTOP);
            });

            expect(returned).toBeNull();
        });

        it('returns previous snapshot', () => {
            const { result } = renderHook(() => useLayoutHistory());
            const snapshot1 = createSnapshot('1');

            act(() => {
                result.current.push(DESKTOP, snapshot1);
            });

            let returned: HistorySnapshot | null = null;
            act(() => {
                returned = result.current.undo(DESKTOP);
            });

            expect(returned).not.toBeNull();
            expect(returned!.widgets[0].id).toBe('widget-1');
        });

        it('decrements canUndo after undo', () => {
            const { result } = renderHook(() => useLayoutHistory());

            act(() => {
                result.current.push(DESKTOP, createSnapshot('1'));
            });

            expect(result.current.canUndo(DESKTOP)).toBe(true);

            act(() => {
                result.current.undo(DESKTOP);
            });

            expect(result.current.canUndo(DESKTOP)).toBe(false);
        });
    });

    describe('redo', () => {
        it('returns null when stack is empty', () => {
            const { result } = renderHook(() => useLayoutHistory());

            let returned: HistorySnapshot | null = null;
            act(() => {
                returned = result.current.redo(DESKTOP);
            });

            expect(returned).toBeNull();
        });

        it('returns next snapshot after pushToRedo', () => {
            const { result } = renderHook(() => useLayoutHistory());
            const redoSnapshot = createSnapshot('redo');

            act(() => {
                result.current.pushToRedo(DESKTOP, redoSnapshot);
            });

            let returned: HistorySnapshot | null = null;
            act(() => {
                returned = result.current.redo(DESKTOP);
            });

            expect(returned).not.toBeNull();
            expect(returned!.widgets[0].id).toBe('widget-redo');
        });
    });

    describe('clear', () => {
        it('empties all stacks when called without args', () => {
            const { result } = renderHook(() => useLayoutHistory());

            act(() => {
                result.current.push(DESKTOP, createSnapshot('1'));
                result.current.push(MOBILE, createSnapshot('2'));
                result.current.pushToRedo(DESKTOP, createSnapshot('3'));
            });

            expect(result.current.canUndo(DESKTOP)).toBe(true);
            expect(result.current.canUndo(MOBILE)).toBe(true);
            expect(result.current.canRedo(DESKTOP)).toBe(true);

            act(() => {
                result.current.clear();
            });

            expect(result.current.canUndo(DESKTOP)).toBe(false);
            expect(result.current.canUndo(MOBILE)).toBe(false);
            expect(result.current.canRedo(DESKTOP)).toBe(false);
            expect(result.current.canRedo(MOBILE)).toBe(false);
        });

        it('empties only specified stack', () => {
            const { result } = renderHook(() => useLayoutHistory());

            act(() => {
                result.current.push(DESKTOP, createSnapshot('1'));
                result.current.push(MOBILE, createSnapshot('2'));
            });

            expect(result.current.canUndo(DESKTOP)).toBe(true);
            expect(result.current.canUndo(MOBILE)).toBe(true);

            act(() => {
                result.current.clear(DESKTOP);
            });

            expect(result.current.canUndo(DESKTOP)).toBe(false);
            expect(result.current.canUndo(MOBILE)).toBe(true); // Mobile still has history
        });
    });

    describe('stack isolation', () => {
        it('desktop and mobile stacks are independent', () => {
            const { result } = renderHook(() => useLayoutHistory());

            act(() => {
                result.current.push(DESKTOP, createSnapshot('desktop-1'));
                result.current.push(DESKTOP, createSnapshot('desktop-2'));
                result.current.push(MOBILE, createSnapshot('mobile-1'));
            });

            // Desktop has 2 items, mobile has 1
            let desktopUndo1: HistorySnapshot | null = null;
            act(() => {
                desktopUndo1 = result.current.undo(DESKTOP);
            });
            expect(desktopUndo1!.widgets[0].id).toBe('widget-desktop-2');
            expect(result.current.canUndo(DESKTOP)).toBe(true); // Still 1 more

            let mobileUndo: HistorySnapshot | null = null;
            act(() => {
                mobileUndo = result.current.undo(MOBILE);
            });
            expect(mobileUndo!.widgets[0].id).toBe('widget-mobile-1');
            expect(result.current.canUndo(MOBILE)).toBe(false); // Now empty
        });
    });

    describe('immutability', () => {
        it('does not mutate pushed snapshot', () => {
            const { result } = renderHook(() => useLayoutHistory());
            const snapshot = createSnapshot('1');
            const originalJson = JSON.stringify(snapshot);

            act(() => {
                result.current.push(DESKTOP, snapshot);
            });

            // Mutate original
            snapshot.widgets[0].id = 'mutated';

            let returned: HistorySnapshot | null = null;
            act(() => {
                returned = result.current.undo(DESKTOP);
            });

            // Returned should have original value
            expect(returned!.widgets[0].id).toBe('widget-1');
            expect(JSON.stringify(returned)).toBe(originalJson);
        });
    });
});

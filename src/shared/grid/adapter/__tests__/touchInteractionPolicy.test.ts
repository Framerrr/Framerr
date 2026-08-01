import { describe, it, expect } from 'vitest';
import {
    TOUCH_HOLD_DELAY_MS,
    TOUCH_EXTERNAL_HOLD_DELAY_MS,
    TOUCH_HOLD_TOLERANCE_PX,
    TOUCH_ORPHAN_ACTIVATION_TIMEOUT_MS,
    buildGridStackOptions,
    shouldResetStalledTouchState,
} from '../GridStackAdapterV2';
import type { GridPolicy } from '../../core/types';
import { GRID_COLS, GRID_MARGIN, ROW_HEIGHT } from '../../../../constants/gridConfig';

function basePolicy(autoScroll: boolean): GridPolicy {
    return {
        layout: {
            responsive: true,
            cols: { lg: GRID_COLS.lg, sm: GRID_COLS.sm },
            breakpoints: { lg: 768, sm: 0 },
            rowHeight: ROW_HEIGHT,
            margin: GRID_MARGIN,
            compactType: 'vertical',
            preventCollision: false,
        },
        interaction: {
            canDrag: true,
            canResize: true,
            resizeHandles: ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'],
            draggableCancel: '.no-drag',
            isBounded: false,
        },
        behavior: {
            commitStrategy: 'on-stop',
            selectionMode: 'none',
            touchActivation: autoScroll ? 'long-press' : 'none',
            autoScroll,
            ...(autoScroll ? { autoScrollContainerId: 'dashboard-layer' as const } : {}),
        },
        view: {
            breakpoint: 'lg',
        },
    };
}

describe('touchInteractionPolicy', () => {
    it('TOUCH_HOLD_DELAY_MS is 350ms (>200ms baseline)', () => {
        expect(TOUCH_HOLD_DELAY_MS).toBe(350);
        expect(TOUCH_HOLD_DELAY_MS).toBeGreaterThan(200);
    });

    it('TOUCH_EXTERNAL_HOLD_DELAY_MS is 300ms (shorter than dashboard hold)', () => {
        expect(TOUCH_EXTERNAL_HOLD_DELAY_MS).toBe(300);
        expect(TOUCH_EXTERNAL_HOLD_DELAY_MS).toBeLessThan(TOUCH_HOLD_DELAY_MS);
    });

    it('TOUCH_HOLD_TOLERANCE_PX is 8px (≥5px floor, ≤10px)', () => {
        expect(TOUCH_HOLD_TOLERANCE_PX).toBe(8);
        expect(TOUCH_HOLD_TOLERANCE_PX).toBeGreaterThanOrEqual(5);
        expect(TOUCH_HOLD_TOLERANCE_PX).toBeLessThanOrEqual(10);
    });

    it('buildGridStackOptions dashboard policy: framerrDisableResizeScroll=true', () => {
        const opts = buildGridStackOptions(basePolicy(true));
        expect(opts.framerrDisableResizeScroll).toBe(true);
        expect(opts.alwaysShowResizeHandle).toBe(true);
        const handles = opts.resizable?.handles ?? '';
        expect(handles).toContain('se');
        expect(handles).toContain('sw');
        expect(handles).toContain('nw');
    });

    it('buildGridStackOptions template policy: framerrDisableResizeScroll=false', () => {
        const opts = buildGridStackOptions(basePolicy(false));
        expect(opts.framerrDisableResizeScroll).toBe(false);
    });

    it('buildGridStackOptions disables animate when transformScale is set (template/iOS)', () => {
        const scaled = basePolicy(false);
        scaled.layout.transformScale = 0.5;
        expect(buildGridStackOptions(scaled).animate).toBe(false);
        expect(buildGridStackOptions(basePolicy(true)).animate).toBe(true);
    });

    describe('shouldResetStalledTouchState', () => {
        const stalled = {
            mouseHandled: false,
            touchHandled: true,
            hasDragElement: false,
            touchActivated: false,
            resizeDir: undefined as string | undefined,
            hasUiDragging: false,
            hasUiResizing: false,
        };

        it('resets when flags are stuck with no live gesture', () => {
            expect(shouldResetStalledTouchState(stalled)).toBe(true);
        });

        it('does not reset during active touch resize (no dragElement)', () => {
            expect(shouldResetStalledTouchState({
                ...stalled,
                touchActivated: true,
                resizeDir: 'se',
                hasUiResizing: true,
            })).toBe(false);
        });

        it('does not reset when only touchActivated (post-hold, pre-move threshold)', () => {
            expect(shouldResetStalledTouchState({
                ...stalled,
                touchActivated: true,
            })).toBe(false);
        });

        it('does not reset when .ui-resizable-resizing is present', () => {
            expect(shouldResetStalledTouchState({
                ...stalled,
                hasUiResizing: true,
            })).toBe(false);
        });

        it('resets an orphaned activation past the timeout with no live gesture', () => {
            expect(shouldResetStalledTouchState({
                ...stalled,
                touchActivated: true,
                touchActivatedElapsedMs: TOUCH_ORPHAN_ACTIVATION_TIMEOUT_MS,
            })).toBe(true);
        });

        it('does not reset an orphan candidate below the timeout', () => {
            expect(shouldResetStalledTouchState({
                ...stalled,
                touchActivated: true,
                touchActivatedElapsedMs: TOUCH_ORPHAN_ACTIVATION_TIMEOUT_MS - 1,
            })).toBe(false);
        });

        it('never resets past the timeout if resizeDir/hasUiResizing is live', () => {
            expect(shouldResetStalledTouchState({
                ...stalled,
                touchActivated: true,
                touchActivatedElapsedMs: TOUCH_ORPHAN_ACTIVATION_TIMEOUT_MS * 2,
                resizeDir: 'se',
                hasUiResizing: true,
            })).toBe(false);
        });
    });
});

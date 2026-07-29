/**
 * Pending-hold cancel wiring — TASK-20260726-003
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DDManager } from '../dd-manager';
import { DDTouch, touchstart, touchmove, touchend } from '../dd-touch';
import { TOUCH_HOLD_TOLERANCE_PX } from '../../../shared/grid/adapter/GridStackAdapterV2';

describe('pendingHoldCancel', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        DDTouch.touchHandled = false;
        DDManager.touchActivated = false;
        DDManager.touchActivatedAt = undefined;
        DDManager.touchTimeoutId = null;
        DDManager.unlockRampTimeoutId = null;
        DDManager.savedTouchEvent = null;
        DDManager.touchInitialX = 0;
        DDManager.touchInitialY = 0;
        DDManager.touchDelay = 350;
        DDManager.externalTouchDelay = 300;
        DDManager.touchTolerance = TOUCH_HOLD_TOLERANCE_PX;
    });

    afterEach(() => {
        if (DDManager.touchTimeoutId) {
            clearTimeout(DDManager.touchTimeoutId);
            DDManager.touchTimeoutId = null;
        }
        if (DDManager.unlockRampTimeoutId) {
            clearTimeout(DDManager.unlockRampTimeoutId);
            DDManager.unlockRampTimeoutId = null;
        }
        DDTouch.touchHandled = false;
        DDManager.touchActivated = false;
        DDManager.touchActivatedAt = undefined;
        DDManager.savedTouchEvent = null;
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    function makeTouchEvent(
        target: HTMLElement,
        clientX: number,
        clientY: number,
        type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel' = 'touchstart',
    ): TouchEvent {
        const touch = { clientX, clientY } as Touch;
        return {
            type,
            target,
            changedTouches: [touch],
            touches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as TouchEvent;
    }

    function appendGridItem(): HTMLElement {
        const item = document.createElement('div');
        item.className = 'grid-stack-item';
        document.body.appendChild(item);
        return item;
    }

    /** jsdom rejects legacy initMouseEvent view=window; activateDrag still sets flags/classes first. */
    function stubSimulatedMouseDown(): void {
        vi.spyOn(document, 'createEvent').mockImplementation((type: string) => {
            const ev = new Event(type === 'MouseEvents' ? 'mousedown' : type);
            (ev as unknown as { initMouseEvent: () => void }).initMouseEvent = vi.fn();
            return ev as unknown as Event;
        });
    }

    it('arms document listeners during pending hold', () => {
        const addSpy = vi.spyOn(document, 'addEventListener');
        const item = appendGridItem();

        touchstart(makeTouchEvent(item, 10, 10));

        expect(addSpy).toHaveBeenCalledWith('touchmove', touchmove, { passive: true });
        expect(addSpy).toHaveBeenCalledWith('touchend', touchend);
        expect(addSpy).toHaveBeenCalledWith('touchcancel', touchend);
        addSpy.mockRestore();
    });

    it('early touchend before the timer elapses cancels cleanly (no activateDrag after lift)', () => {
        const removeSpy = vi.spyOn(document, 'removeEventListener');
        const item = appendGridItem();

        touchstart(makeTouchEvent(item, 10, 10));
        touchend(makeTouchEvent(item, 10, 10, 'touchend'));

        expect(DDTouch.touchHandled).toBe(false);
        expect(DDManager.touchActivated).toBe(false);
        expect(item.classList.contains('widget-unlocked')).toBe(false);
        expect(item.classList.contains('widget-unlocking')).toBe(false);
        expect(removeSpy).toHaveBeenCalledWith('touchmove', touchmove);
        expect(removeSpy).toHaveBeenCalledWith('touchend', touchend);
        expect(removeSpy).toHaveBeenCalledWith('touchcancel', touchend);

        vi.advanceTimersByTime(500);
        expect(item.classList.contains('widget-unlocked')).toBe(false);
        expect(item.classList.contains('widget-unlocking')).toBe(false);
        removeSpy.mockRestore();
    });

    it('pending touchcancel before the timer elapses cancels cleanly (no late activation)', () => {
        const removeSpy = vi.spyOn(document, 'removeEventListener');
        const item = appendGridItem();

        touchstart(makeTouchEvent(item, 10, 10));
        touchend(makeTouchEvent(item, 10, 10, 'touchcancel'));

        expect(DDTouch.touchHandled).toBe(false);
        expect(DDManager.touchActivated).toBe(false);
        expect(item.classList.contains('widget-unlocked')).toBe(false);
        expect(item.classList.contains('widget-unlocking')).toBe(false);
        expect(removeSpy).toHaveBeenCalledWith('touchcancel', touchend);

        vi.advanceTimersByTime(500);
        expect(item.classList.contains('widget-unlocked')).toBe(false);
        expect(item.classList.contains('widget-unlocking')).toBe(false);
        removeSpy.mockRestore();
    });

    it('touchmove exceeding tolerance during pending cancels via cancelPendingDrag', () => {
        const item = appendGridItem();
        const overTolerance = TOUCH_HOLD_TOLERANCE_PX + 5;

        touchstart(makeTouchEvent(item, 10, 10));
        touchmove(makeTouchEvent(item, 10 + overTolerance, 10, 'touchmove'));

        expect(DDTouch.touchHandled).toBe(false);
        expect(DDManager.touchActivated).toBe(false);
        expect(item.classList.contains('widget-unlocked')).toBe(false);
        expect(item.classList.contains('widget-unlocking')).toBe(false);

        vi.advanceTimersByTime(500);
        expect(item.classList.contains('widget-unlocked')).toBe(false);
        expect(item.classList.contains('widget-unlocking')).toBe(false);
    });

    it('quick tap under 50ms never paints the unlock ramp', () => {
        const item = appendGridItem();

        touchstart(makeTouchEvent(item, 10, 10));
        vi.advanceTimersByTime(40);
        expect(item.classList.contains('widget-unlocking')).toBe(false);

        touchend(makeTouchEvent(item, 10, 10, 'touchend'));
        vi.advanceTimersByTime(500);
        expect(item.classList.contains('widget-unlocking')).toBe(false);
        expect(item.classList.contains('widget-unlocked')).toBe(false);
    });

    it('hold past 50ms ramps, then swaps to unlocked at the hold threshold', () => {
        stubSimulatedMouseDown();
        const item = appendGridItem();

        touchstart(makeTouchEvent(item, 10, 10));
        vi.advanceTimersByTime(50);
        expect(item.classList.contains('widget-unlocking')).toBe(true);
        expect(item.classList.contains('widget-unlocked')).toBe(false);
        expect(item.style.getPropertyValue('--unlock-ramp-ms')).toBe('300ms');

        vi.advanceTimersByTime(300);
        expect(DDManager.touchActivated).toBe(true);
        expect(item.classList.contains('widget-unlocked')).toBe(true);
        expect(item.classList.contains('widget-unlocking')).toBe(false);
    });

    it('touchmove within tolerance does not cancel; timer still fires a healthy hold', () => {
        stubSimulatedMouseDown();
        const item = appendGridItem();

        touchstart(makeTouchEvent(item, 10, 10));
        touchmove(makeTouchEvent(item, 11, 11, 'touchmove'));

        vi.advanceTimersByTime(400);

        expect(DDManager.touchActivated).toBe(true);
        expect(item.classList.contains('widget-unlocked')).toBe(true);
        expect(item.classList.contains('widget-unlocking')).toBe(false);
    });

    it('resize-handle touchstart is unaffected (no pending phase, no passive:true touchmove arm)', () => {
        stubSimulatedMouseDown();
        const addSpy = vi.spyOn(document, 'addEventListener');
        const item = appendGridItem();
        const handle = document.createElement('div');
        handle.className = 'ui-resizable-handle ui-resizable-se';
        item.appendChild(handle);

        touchstart(makeTouchEvent(handle, 10, 10));

        expect(DDManager.touchActivated).toBe(true);
        const passiveTouchMoveArm = addSpy.mock.calls.some(
            (call) => call[0] === 'touchmove' && (call[2] as AddEventListenerOptions)?.passive === true,
        );
        expect(passiveTouchMoveArm).toBe(false);
        addSpy.mockRestore();
    });
});

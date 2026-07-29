/**
 * External vs dashboard touch hold delay selection
 * TASK-20260726-002 (implementation review REQUIRED fix)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DDManager } from '../dd-manager';
import { DDTouch, resolveTouchHoldDelayMs, touchstart } from '../dd-touch';

describe('resolveTouchHoldDelayMs', () => {
    it('uses externalTouchDelay for .modal-widget / .palette-item', () => {
        const modal = document.createElement('div');
        modal.className = 'modal-widget';
        const child = document.createElement('span');
        modal.appendChild(child);

        expect(resolveTouchHoldDelayMs(child, 350, 300)).toBe(300);

        const palette = document.createElement('div');
        palette.className = 'palette-item';
        expect(resolveTouchHoldDelayMs(palette, 350, 300)).toBe(300);
    });

    it('falls back to touchDelay for dashboard grid items', () => {
        const item = document.createElement('div');
        item.className = 'grid-stack-item';
        expect(resolveTouchHoldDelayMs(item, 350, 300)).toBe(350);
    });

    it('falls back to touchDelay when externalTouchDelay is 0', () => {
        const modal = document.createElement('div');
        modal.className = 'modal-widget';
        expect(resolveTouchHoldDelayMs(modal, 350, 0)).toBe(350);
    });
});

describe('touchstart delay selection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        DDTouch.touchHandled = false;
        DDManager.touchActivated = false;
        DDManager.touchTimeoutId = null;
        DDManager.savedTouchEvent = null;
        DDManager.touchDelay = 350;
        DDManager.externalTouchDelay = 300;
        DDManager.touchTolerance = 8;
    });

    afterEach(() => {
        if (DDManager.touchTimeoutId) {
            clearTimeout(DDManager.touchTimeoutId);
            DDManager.touchTimeoutId = null;
        }
        DDTouch.touchHandled = false;
        DDManager.touchActivated = false;
        DDManager.savedTouchEvent = null;
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    function fireTouchStart(target: HTMLElement) {
        const touch = { clientX: 10, clientY: 10 } as Touch;
        const event = {
            target,
            changedTouches: [touch],
            touches: [touch],
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as TouchEvent;
        touchstart(event);
    }

    it('schedules externalTouchDelay for modal-widget touchstart', () => {
        const spy = vi.spyOn(globalThis, 'setTimeout');
        const modal = document.createElement('div');
        modal.className = 'modal-widget';
        document.body.appendChild(modal);

        fireTouchStart(modal);

        const delayCall = spy.mock.calls.find((call) => typeof call[1] === 'number');
        expect(delayCall?.[1]).toBe(300);
        spy.mockRestore();
    });

    it('schedules touchDelay for dashboard grid-stack-item touchstart', () => {
        const spy = vi.spyOn(globalThis, 'setTimeout');
        const item = document.createElement('div');
        item.className = 'grid-stack-item';
        document.body.appendChild(item);

        fireTouchStart(item);

        const delayCall = spy.mock.calls.find((call) => typeof call[1] === 'number');
        expect(delayCall?.[1]).toBe(350);
        spy.mockRestore();
    });
});

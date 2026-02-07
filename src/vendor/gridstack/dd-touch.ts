// @ts-nocheck
/**
 * touch.ts 10.3.1
 * Copyright (c) 2021 Alain Dumesny - see GridStack root license
 */

import { DDManager } from './dd-manager';

/**
 * Detect touch support - Windows Surface devices and other touch devices
 * should we use this instead ? (what we had for always showing resize handles)
 * /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
 */
export const isTouch: boolean = typeof window !== 'undefined' && typeof document !== 'undefined' &&
  ('ontouchstart' in document
    || 'ontouchstart' in window
    // || !!window.TouchEvent // true on Windows 10 Chrome desktop so don't use this
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    || ((window as any).DocumentTouch && document instanceof (window as any).DocumentTouch)
    || navigator.maxTouchPoints > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    || (navigator as any).msMaxTouchPoints > 0
  );

// interface TouchCoord {x: number, y: number};

export class DDTouch {
  public static touchHandled: boolean;
  public static pointerLeaveTimeout: number;
  // FRAMERR: Track last known touch position from touchmove events.
  // Used by pointerleave guard because iOS PointerEvent coordinates
  // can be incorrect after grid layout reflows.
  public static lastTouchX: number;
  public static lastTouchY: number;
}

/**
* Get the x,y position of a touch event
*/
// function getTouchCoords(e: TouchEvent): TouchCoord {
//   return {
//     x: e.changedTouches[0].pageX,
//     y: e.changedTouches[0].pageY
//   };
// }

/**
 * Simulate a mouse event based on a corresponding touch event
 * @param {Object} e A touch event
 * @param {String} simulatedType The corresponding mouse event
 */
function simulateMouseEvent(e: TouchEvent, simulatedType: string) {

  // Ignore multi-touch events
  if (e.touches.length > 1) return;

  // Prevent "Ignored attempt to cancel a touchmove event with cancelable=false" errors
  if (e.cancelable) e.preventDefault();

  const touch = e.changedTouches[0], simulatedEvent = document.createEvent('MouseEvents');

  // Initialize the simulated mouse event using the touch event's coordinates
  simulatedEvent.initMouseEvent(
    simulatedType,    // type
    true,             // bubbles
    true,             // cancelable
    window,           // view
    1,                // detail
    touch.screenX,    // screenX
    touch.screenY,    // screenY
    touch.clientX,    // clientX
    touch.clientY,    // clientY
    false,            // ctrlKey
    false,            // altKey
    false,            // shiftKey
    false,            // metaKey
    0,                // button
    null              // relatedTarget
  );

  // Dispatch the simulated event to the target element
  e.target.dispatchEvent(simulatedEvent);
}

/**
 * Simulate a mouse event based on a corresponding Pointer event
 * @param {Object} e A pointer event
 * @param {String} simulatedType The corresponding mouse event
 */
function simulatePointerMouseEvent(e: PointerEvent, simulatedType: string) {

  // Prevent "Ignored attempt to cancel a touchmove event with cancelable=false" errors
  if (e.cancelable) e.preventDefault();

  const simulatedEvent = document.createEvent('MouseEvents');

  // Initialize the simulated mouse event using the touch event's coordinates
  simulatedEvent.initMouseEvent(
    simulatedType,    // type
    true,             // bubbles
    true,             // cancelable
    window,           // view
    1,                // detail
    e.screenX,    // screenX
    e.screenY,    // screenY
    e.clientX,    // clientX
    e.clientY,    // clientY
    false,            // ctrlKey
    false,            // altKey
    false,            // shiftKey
    false,            // metaKey
    0,                // button
    null              // relatedTarget
  );

  // Dispatch the simulated event to the target element
  e.target.dispatchEvent(simulatedEvent);
}


// FRAMERR: Helper to check if movement exceeds tolerance
function hasExceededTolerance(e: TouchEvent): boolean {
  const touch = e.changedTouches[0];
  const deltaX = Math.abs(touch.clientX - DDManager.touchInitialX);
  const deltaY = Math.abs(touch.clientY - DDManager.touchInitialY);
  return deltaX > DDManager.touchTolerance || deltaY > DDManager.touchTolerance;
}

// FRAMERR: Activate drag after delay (called by timer or immediately)
function activateDrag(): void {
  if (DDManager.touchActivated) return; // Already activated
  DDManager.touchActivated = true;

  // Now simulate mousedown using the saved touchstart event
  if (DDManager.savedTouchEvent) {
    simulateMouseEvent(DDManager.savedTouchEvent, 'mousedown');
  }
}

// FRAMERR: Cancel pending drag (user was scrolling)
function cancelPendingDrag(): void {
  if (DDManager.touchTimeoutId) {
    clearTimeout(DDManager.touchTimeoutId);
    DDManager.touchTimeoutId = null;
  }
  DDManager.touchActivated = false;
  DDManager.savedTouchEvent = null;
  DDTouch.touchHandled = false;
}

/**
 * Handle the touchstart events
 * @param {Object} e The widget element's touchstart event
 */
export function touchstart(e: TouchEvent): void {
  // Ignore the event if another widget is already being handled
  if (DDTouch.touchHandled) return;
  DDTouch.touchHandled = true;

  const touch = e.changedTouches[0];

  // Save initial state for pending period
  DDManager.touchInitialX = touch.clientX;
  DDManager.touchInitialY = touch.clientY;
  DDManager.savedTouchEvent = e;
  DDManager.touchActivated = false;

  // FRAMERR: Resize handles should respond instantly (no hold delay).
  // Only drag (widget body) needs hold-to-drag to allow scrolling.
  const target = e.target as HTMLElement;
  const isResizeHandle = target?.closest?.('.ui-resizable-handle');
  if (isResizeHandle || DDManager.touchDelay <= 0) {
    activateDrag();
    return;
  }

  // Start delay timer - activate after delay if still within tolerance
  DDManager.touchTimeoutId = setTimeout(() => {
    DDManager.touchTimeoutId = null;
    // Only activate if we haven't been cancelled and finger hasn't moved too much
    if (DDTouch.touchHandled && !DDManager.touchActivated) {
      activateDrag();
    }
  }, DDManager.touchDelay);

  // DON'T simulate mousedown yet - allow scrolling during pending period!
}

/**
 * Handle the touchmove events
 * @param {Object} e The document's touchmove event
 */
export function touchmove(e: TouchEvent): void {
  // Ignore event if not handled by us
  if (!DDTouch.touchHandled) return;

  // FRAMERR: If not yet activated, check if we should cancel (user is scrolling)
  if (!DDManager.touchActivated) {
    if (hasExceededTolerance(e)) {
      // Finger moved too much during pending period - user is scrolling
      cancelPendingDrag();
      return;
    }
    // Still in pending period, don't simulate any events yet
    // This allows the browser to scroll!
    return;
  }


  // ACTIVATED: Now we can simulate mousemove and block scroll
  // FRAMERR: Track last known touch position for _leave() guard in gridstack.ts
  const touch = e.changedTouches[0];
  DDManager.lastTouchX = touch.clientX;
  DDManager.lastTouchY = touch.clientY;
  simulateMouseEvent(e, 'mousemove');
}

/**
 * Handle the touchend events
 * @param {Object} e The document's touchend event
 */
export function touchend(e: TouchEvent): void {

  // Ignore event if not handled
  if (!DDTouch.touchHandled) return;

  // Clear any pending timeout
  if (DDManager.touchTimeoutId) {
    clearTimeout(DDManager.touchTimeoutId);
    DDManager.touchTimeoutId = null;
  }

  // cancel delayed leave event when we release on ourself which happens BEFORE we get this!
  if (DDTouch.pointerLeaveTimeout) {
    window.clearTimeout(DDTouch.pointerLeaveTimeout);
    delete DDTouch.pointerLeaveTimeout;
  }

  const wasDragging = !!DDManager.dragElement;
  const wasActivated = DDManager.touchActivated;

  // Only simulate mouseup if we actually activated
  if (wasActivated) {
    simulateMouseEvent(e, 'mouseup');
  }

  // If the touch interaction was not a drag, it should trigger a click
  if (!wasDragging && wasActivated) {
    simulateMouseEvent(e, 'click');
  }

  // FRAMERR: Reset all touch state for next interaction
  DDManager.touchInitialX = 0;
  DDManager.touchInitialY = 0;
  DDManager.touchActivated = false;
  DDManager.savedTouchEvent = null;
  DDManager.lastTouchX = undefined;
  DDManager.lastTouchY = undefined;

  // Unset the flag to allow other widgets to inherit the touch event
  DDTouch.touchHandled = false;
}

/**
 * Note we don't get touchenter/touchleave (which are deprecated)
 * see https://stackoverflow.com/questions/27908339/js-touch-equivalent-for-mouseenter
 * so instead of PointerEvent to still get enter/leave and send the matching mouse event.
 */
export function pointerdown(e: PointerEvent): void {
  // console.log("pointer down")
  if (e.pointerType === 'mouse') return;
  (e.target as HTMLElement).releasePointerCapture(e.pointerId) // <- Important!
}

export function pointerenter(e: PointerEvent): void {
  // ignore the initial one we get on pointerdown on ourself
  if (!DDManager.dragElement) {
    // console.log('pointerenter ignored');
    return;
  }
  // console.log('pointerenter');
  if (e.pointerType === 'mouse') return;
  simulatePointerMouseEvent(e, 'mouseenter');
}

export function pointerleave(e: PointerEvent): void {
  // ignore the leave on ourself we get before releasing the mouse over ourself
  // by delaying sending the event and having the up event cancel us
  if (!DDManager.dragElement) {
    // console.log('pointerleave ignored');
    return;
  }
  if (e.pointerType === 'mouse') return;

  // FRAMERR: Guard against false pointerleave events during active touch drag on iOS.
  // iOS fires false pointerleave after grid layout changes (e.g. widgets pushed down).
  // The PointerEvent's clientX/Y can be incorrect, so use the last known touch
  // coordinates from touchmove which are always accurate.
  const gridEl = (e.currentTarget || e.target) as HTMLElement;
  if (gridEl && DDManager.dragElement) {
    const rect = gridEl.getBoundingClientRect();
    // Use last known touch position (accurate) instead of PointerEvent coords (unreliable on iOS)
    const x = DDManager.lastTouchX ?? e.clientX;
    const y = DDManager.lastTouchY ?? e.clientY;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      // Touch point is still inside the grid — suppress false leave
      return;
    }
  }

  DDTouch.pointerLeaveTimeout = window.setTimeout(() => {
    delete DDTouch.pointerLeaveTimeout;
    // console.log('pointerleave delayed');
    simulatePointerMouseEvent(e, 'mouseleave');
  }, 10);
}


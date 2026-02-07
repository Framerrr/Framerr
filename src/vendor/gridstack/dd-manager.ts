// @ts-nocheck
/**
 * dd-manager.ts 10.3.1 (modified for Framerr touch delay)
 * Copyright (c) 2021 Alain Dumesny - see GridStack root license
 */

import { DDDraggable } from './dd-draggable';
import { DDDroppable } from './dd-droppable';
import { DDResizable } from './dd-resizable';

/**
 * globals that are shared across Drag & Drop instances
 */
export class DDManager {
  /** if set (true | in msec), dragging placement (collision) will only happen after a pause by the user*/
  public static pauseDrag: boolean | number;

  /** true if a mouse down event was handled */
  public static mouseHandled: boolean;

  /** item being dragged */
  public static dragElement: DDDraggable;

  /** item we are currently over as drop target */
  public static dropElement: DDDroppable;

  /** current item we're over for resizing purpose (ignore nested grid resize handles) */
  public static overResizeElement: DDResizable;

  // ========== FRAMERR TOUCH DELAY (dnd-kit pattern) ==========

  /**
   * Touch delay in milliseconds before drag activates.
   * Set via DDManager.touchDelay = 200 before GridStack.init().
   * Default 0 = immediate drag (original behavior).
   */
  public static touchDelay: number = 0;

  /**
   * Movement tolerance in pixels during delay.
   * If finger moves more than this during delay, cancel (user is scrolling).
   */
  public static touchTolerance: number = 10;

  /**
   * Initial touch coordinates for tolerance checking.
   */
  public static touchInitialX: number = 0;
  public static touchInitialY: number = 0;

  /**
   * Timer ID for the delay timeout.
   */
  public static touchTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Whether touch drag has been activated (delay passed, within tolerance).
   */
  public static touchActivated: boolean = false;

  /**
   * The original touchstart event for simulating mousedown on activation.
   */
  public static savedTouchEvent: TouchEvent | null = null;

  // FRAMERR: Last known touch position from touchmove events.
  // Used by _leave() guard to suppress false leave events on iOS.
  public static lastTouchX: number | undefined;
  public static lastTouchY: number | undefined;
}

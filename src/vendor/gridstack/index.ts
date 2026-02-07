// @ts-nocheck
/**
 * GridStack v10.3.1 Barrel Export (Vendored)
 * 
 * This re-exports all public GridStack APIs from the vendored source.
 * Import from '@vendor/gridstack' or via alias 'gridstack'.
 * 
 * MODIFICATIONS:
 * - dd-manager.ts: Added touchDelay, touchStartTime, touchDelayPassed
 * - dd-touch.ts: Modified touchstart/touchmove to implement delay
 */

export { GridStack } from './gridstack';
export { DDManager } from './dd-manager';
export { DDDraggable } from './dd-draggable';
export { DDDroppable } from './dd-droppable';
export { DDResizable } from './dd-resizable';
export { isTouch } from './dd-touch';
export * from './types';

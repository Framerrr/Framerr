/**
 * GridStack addRemoveCB implementation for React integration.
 * 
 * This callback is called by GridStack when widgets need to be created or removed.
 * Instead of GridStack creating elements and us modifying them, we create the elements
 * correctly upfront with React portal targets.
 * 
 * Official API: GridStack.addRemoveCB
 * Signature: (parent: HTMLElement, w: GridStackWidget, add: boolean, grid: boolean) => HTMLElement | undefined
 */

import { GridStack } from '../../../vendor/gridstack/gridstack';
import type { GridStackWidget } from '../../../vendor/gridstack/types';

/**
 * Creates widget element with proper structure for React portal rendering.
 * 
 * @param w - Widget options from GridStack (id, x, y, w, h, etc.)
 * @returns HTMLElement ready for React portal
 */
export function createWidgetElement(w: GridStackWidget): HTMLElement {
    const id = w.id || `w${Date.now()}`;

    // Create outer grid-stack-item element
    const el = document.createElement('div');
    el.className = 'grid-stack-item';
    el.setAttribute('gs-id', String(id));

    // Create grid-stack-item-content (required by GridStack)
    const content = document.createElement('div');
    content.className = 'grid-stack-item-content';

    // Create React portal target
    const portal = document.createElement('div');
    portal.setAttribute('data-widget-portal', String(id));

    // Assemble structure
    content.appendChild(portal);
    el.appendChild(content);

    return el;
}

/**
 * The callback function that GridStack will call.
 */
function addRemoveCallback(
    parent: HTMLElement,
    w: GridStackWidget,
    add: boolean,
    isGrid: boolean
): HTMLElement | undefined {
    // We don't handle nested grid creation
    if (isGrid) {
        return undefined;
    }

    if (add) {
        // CREATE: Build widget element with React portal target
        const el = createWidgetElement(w);
        // Don't append - GridStack will handle that
        return el;
    } else {
        // REMOVE: React portals clean up automatically when element is removed
        return undefined;
    }
}

/**
 * Registers our callback with GridStack.
 * Call this BEFORE initializing any GridStack instances.
 */
export function registerAddRemoveCB(): void {
    GridStack.addRemoveCB = addRemoveCallback;
}

/**
 * Unregisters the callback (for cleanup/testing).
 */
export function unregisterAddRemoveCB(): void {
    delete GridStack.addRemoveCB;
}

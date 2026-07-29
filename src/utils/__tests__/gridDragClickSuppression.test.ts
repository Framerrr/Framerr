/**
 * gridDragClickSuppression — TASK-20260727-004
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    markGridDragStarted,
    markGridDragStopped,
    consumeGridDragSuppression,
    __resetGridDragSuppressionForTests,
} from '../gridDragClickSuppression';

function makeGridItemWithChild(): { gridItem: HTMLElement; child: HTMLElement } {
    const gridItem = document.createElement('div');
    gridItem.className = 'grid-stack-item';
    const content = document.createElement('div');
    content.className = 'grid-stack-item-content';
    const child = document.createElement('a');
    content.appendChild(child);
    gridItem.appendChild(content);
    document.body.appendChild(gridItem);
    return { gridItem, child };
}

describe('gridDragClickSuppression', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        __resetGridDragSuppressionForTests();
        document.body.replaceChildren();
    });

    afterEach(() => {
        __resetGridDragSuppressionForTests();
        vi.useRealTimers();
        document.body.replaceChildren();
    });

    it('returns true when consuming immediately after mark on same element', () => {
        const { gridItem } = makeGridItemWithChild();
        markGridDragStopped(gridItem);
        expect(consumeGridDragSuppression(gridItem)).toBe(true);
    });

    it('returns true when consuming a descendant of the marked grid item', () => {
        const { gridItem, child } = makeGridItemWithChild();
        markGridDragStopped(gridItem);
        expect(consumeGridDragSuppression(child)).toBe(true);
    });

    it('returns false for an unrelated element', () => {
        const { gridItem } = makeGridItemWithChild();
        const other = document.createElement('div');
        other.className = 'grid-stack-item';
        document.body.appendChild(other);
        markGridDragStopped(gridItem);
        expect(consumeGridDragSuppression(other)).toBe(false);
    });

    it('consumes the flag once — second consume returns false', () => {
        const { gridItem, child } = makeGridItemWithChild();
        markGridDragStopped(gridItem);
        expect(consumeGridDragSuppression(child)).toBe(true);
        expect(consumeGridDragSuppression(child)).toBe(false);
    });

    it('expires after SUPPRESSION_WINDOW_MS following dragstop', () => {
        const { gridItem, child } = makeGridItemWithChild();
        markGridDragStopped(gridItem);
        vi.advanceTimersByTime(201);
        expect(consumeGridDragSuppression(child)).toBe(false);
    });

    it('returns false when no prior mark call', () => {
        const { child } = makeGridItemWithChild();
        expect(consumeGridDragSuppression(child)).toBe(false);
    });

    it('stays armed during a long drag after dragstart (does not expire mid-drag)', () => {
        const { gridItem, child } = makeGridItemWithChild();
        markGridDragStarted(gridItem);
        vi.advanceTimersByTime(5_000);
        expect(consumeGridDragSuppression(child)).toBe(true);
    });

    it('resolves a child target from dragstart up to .grid-stack-item', () => {
        const { gridItem, child } = makeGridItemWithChild();
        // GridStack sometimes passes event.target (the tile), not the item
        markGridDragStarted(child);
        expect(consumeGridDragSuppression(child)).toBe(true);
        // already consumed
        markGridDragStarted(child);
        const otherChild = document.createElement('button');
        gridItem.querySelector('.grid-stack-item-content')!.appendChild(otherChild);
        expect(consumeGridDragSuppression(otherChild)).toBe(true);
    });

    it('dragstop refreshes the post-drop window after a long drag', () => {
        const { gridItem, child } = makeGridItemWithChild();
        markGridDragStarted(gridItem);
        vi.advanceTimersByTime(5_000);
        markGridDragStopped(gridItem);
        vi.advanceTimersByTime(150);
        expect(consumeGridDragSuppression(child)).toBe(true);
    });
});

/**
 * Grid Core Operations - Unit Tests
 *
 * Tests for pure layout operations in ops.ts.
 * Run with: npm run test:run -- src/shared/grid/core/ops.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
    // Widget CRUD
    addWidget,
    deleteWidget,
    duplicateWidget,
    // Widget modification
    updateWidgetConfig,
    resizeWidget,
    moveWidget,
    // Layout operations
    widgetsToLayoutItems,
    widgetsToLayoutModel,
    applyLayoutToWidgets,
    normalizeLayout,
    validateLayout,
    applyConstraintsToLayout,
    // Mobile layout
    deriveLinkedMobileLayout,
    snapshotToMobileLayout,
    // Change detection
    isDifferent,
    getChangedWidgetIds,
    widgetSetsMatch,
    // Utilities
    getWidgetById,
    generateWidgetId,
} from './ops';
import type { FramerrWidget, LayoutItem } from './types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createWidget = (overrides: Partial<FramerrWidget> = {}): FramerrWidget => ({
    id: `widget-${Date.now()}`,
    type: 'clock',
    layout: { x: 0, y: 0, w: 4, h: 2 },
    config: {},
    ...overrides,
});

const fixtureWidgets: FramerrWidget[] = [
    { id: 'w1', type: 'clock', layout: { x: 0, y: 0, w: 4, h: 2 }, config: {} },
    { id: 'w2', type: 'weather', layout: { x: 4, y: 0, w: 4, h: 3 }, config: {} },
    { id: 'w3', type: 'calendar', layout: { x: 8, y: 0, w: 4, h: 4 }, config: {} },
];

// ============================================================================
// WIDGET CRUD TESTS
// ============================================================================

describe('addWidget', () => {
    it('adds a widget to the array', () => {
        const newWidget = createWidget({ id: 'new' });
        const result = addWidget(fixtureWidgets, newWidget);

        expect(result).toHaveLength(4);
        expect(result[3]).toEqual(newWidget);
    });

    it('does not mutate original array', () => {
        const original = [...fixtureWidgets];
        const newWidget = createWidget({ id: 'new' });
        addWidget(fixtureWidgets, newWidget);

        expect(fixtureWidgets).toEqual(original);
    });

    it('works with empty array', () => {
        const newWidget = createWidget({ id: 'first' });
        const result = addWidget([], newWidget);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('first');
    });
});

describe('deleteWidget', () => {
    it('removes a widget by ID', () => {
        const result = deleteWidget(fixtureWidgets, 'w2');

        expect(result).toHaveLength(2);
        expect(result.find(w => w.id === 'w2')).toBeUndefined();
    });

    it('returns same array if ID not found', () => {
        const result = deleteWidget(fixtureWidgets, 'nonexistent');

        expect(result).toHaveLength(3);
    });

    it('does not mutate original array', () => {
        const original = [...fixtureWidgets];
        deleteWidget(fixtureWidgets, 'w1');

        expect(fixtureWidgets).toEqual(original);
    });
});

describe('duplicateWidget', () => {
    it('duplicates a widget with new ID', () => {
        const result = duplicateWidget(fixtureWidgets, 'w1', 'w1-copy');

        expect(result).toHaveLength(4);
        const copy = result.find(w => w.id === 'w1-copy');
        expect(copy).toBeDefined();
        expect(copy?.type).toBe('clock');
    });

    it('offsets the duplicated widget position', () => {
        const result = duplicateWidget(fixtureWidgets, 'w1', 'w1-copy');
        const original = result.find(w => w.id === 'w1');
        const copy = result.find(w => w.id === 'w1-copy');

        expect(copy?.layout.x).toBeGreaterThan(original!.layout.x);
        expect(copy?.layout.y).toBeGreaterThan(original!.layout.y);
    });

    it('returns same array if widget not found', () => {
        const result = duplicateWidget(fixtureWidgets, 'nonexistent');

        expect(result).toHaveLength(3);
    });

    it('generates ID if not provided', () => {
        const result = duplicateWidget(fixtureWidgets, 'w1');

        expect(result).toHaveLength(4);
        expect(result[3].id).toMatch(/^widget-/);
    });
});

// ============================================================================
// WIDGET MODIFICATION TESTS
// ============================================================================

describe('updateWidgetConfig', () => {
    it('updates widget config', () => {
        const result = updateWidgetConfig(fixtureWidgets, 'w1', { showHeader: true });
        const updated = result.find(w => w.id === 'w1');

        expect(updated?.config?.showHeader).toBe(true);
    });

    it('preserves existing config values', () => {
        const widgets = [{ ...fixtureWidgets[0], config: { existing: 'value' } }];
        const result = updateWidgetConfig(widgets, 'w1', { newKey: 'newValue' });

        expect(result[0].config?.existing).toBe('value');
        expect(result[0].config?.newKey).toBe('newValue');
    });

    it('does not mutate original array', () => {
        const original = JSON.stringify(fixtureWidgets);
        updateWidgetConfig(fixtureWidgets, 'w1', { test: true });

        expect(JSON.stringify(fixtureWidgets)).toBe(original);
    });
});

describe('resizeWidget', () => {
    it('updates desktop layout by default', () => {
        const result = resizeWidget(fixtureWidgets, 'w1', { w: 6, h: 3 });
        const updated = result.find(w => w.id === 'w1');

        expect(updated?.layout.w).toBe(6);
        expect(updated?.layout.h).toBe(3);
        expect(updated?.layout.x).toBe(0); // Unchanged
    });

    it('updates mobile layout when breakpoint is sm', () => {
        const result = resizeWidget(fixtureWidgets, 'w1', { w: 2, h: 3 }, 'sm');
        const updated = result.find(w => w.id === 'w1');

        expect(updated?.mobileLayout?.w).toBe(2);
        expect(updated?.mobileLayout?.h).toBe(3);
        expect(updated?.layout.w).toBe(4); // Desktop unchanged
    });
});

describe('moveWidget', () => {
    it('updates position', () => {
        const result = moveWidget(fixtureWidgets, 'w1', { x: 5, y: 3 });
        const updated = result.find(w => w.id === 'w1');

        expect(updated?.layout.x).toBe(5);
        expect(updated?.layout.y).toBe(3);
        expect(updated?.layout.w).toBe(4); // Size unchanged
    });
});

// ============================================================================
// LAYOUT OPERATIONS TESTS
// ============================================================================

describe('widgetsToLayoutItems', () => {
    it('extracts desktop layout', () => {
        const result = widgetsToLayoutItems(fixtureWidgets, 'lg');

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({ id: 'w1', x: 0, y: 0, w: 4, h: 2 });
    });

    it('extracts mobile layout when present', () => {
        const widgets = [
            { ...fixtureWidgets[0], mobileLayout: { x: 0, y: 0, w: 2, h: 2 } },
        ];
        const result = widgetsToLayoutItems(widgets, 'sm');

        expect(result[0].w).toBe(2); // Mobile width
    });

    it('falls back to desktop layout for mobile if no mobileLayout', () => {
        const result = widgetsToLayoutItems(fixtureWidgets, 'sm');

        expect(result[0].w).toBe(4); // Desktop width
    });
});

describe('applyLayoutToWidgets', () => {
    it('updates widget layouts from LayoutItem[]', () => {
        const layout: LayoutItem[] = [
            { id: 'w1', x: 1, y: 2, w: 5, h: 3 },
        ];
        const result = applyLayoutToWidgets(fixtureWidgets, layout, 'lg');
        const updated = result.find(w => w.id === 'w1');

        expect(updated?.layout).toEqual({ x: 1, y: 2, w: 5, h: 3 });
    });

    it('updates mobileLayout when breakpoint is sm', () => {
        const layout: LayoutItem[] = [
            { id: 'w1', x: 0, y: 0, w: 2, h: 2 },
        ];
        const result = applyLayoutToWidgets(fixtureWidgets, layout, 'sm');
        const updated = result.find(w => w.id === 'w1');

        expect(updated?.mobileLayout).toEqual({ x: 0, y: 0, w: 2, h: 2 });
        expect(updated?.layout).toEqual({ x: 0, y: 0, w: 4, h: 2 }); // Desktop unchanged
    });
});

describe('normalizeLayout', () => {
    it('handles null input', () => {
        expect(normalizeLayout(null)).toEqual([]);
    });

    it('handles undefined input', () => {
        expect(normalizeLayout(undefined)).toEqual([]);
    });

    it('handles non-array input', () => {
        expect(normalizeLayout({ not: 'array' })).toEqual([]);
    });

    it('normalizes layout items with missing fields', () => {
        const input = [{ id: 'w1' }];
        const result = normalizeLayout(input);

        expect(result[0]).toEqual({
            id: 'w1',
            x: 0,
            y: 0,
            w: 4,
            h: 2,
            minW: undefined,
            maxW: undefined,
            minH: undefined,
            maxH: undefined,
            locked: false,
            static: false,
        });
    });

    it('handles RGL format (i instead of id)', () => {
        const input = [{ i: 'widget-1', x: 1, y: 2, w: 3, h: 4 }];
        const result = normalizeLayout(input);

        expect(result[0].id).toBe('widget-1');
    });

    it('filters out items without ID', () => {
        const input = [{ x: 0, y: 0, w: 4, h: 2 }];
        const result = normalizeLayout(input);

        expect(result).toHaveLength(0);
    });
});

describe('validateLayout', () => {
    it('returns true for valid layout', () => {
        const layout: LayoutItem[] = [
            { id: 'w1', x: 0, y: 0, w: 4, h: 2 },
            { id: 'w2', x: 4, y: 0, w: 4, h: 2 },
        ];
        expect(validateLayout(layout)).toBe(true);
    });

    it('returns false for duplicate IDs', () => {
        const layout: LayoutItem[] = [
            { id: 'w1', x: 0, y: 0, w: 4, h: 2 },
            { id: 'w1', x: 4, y: 0, w: 4, h: 2 },
        ];
        expect(validateLayout(layout)).toBe(false);
    });

    it('returns false for negative positions', () => {
        const layout: LayoutItem[] = [
            { id: 'w1', x: -1, y: 0, w: 4, h: 2 },
        ];
        expect(validateLayout(layout)).toBe(false);
    });

    it('returns false for zero dimensions', () => {
        const layout: LayoutItem[] = [
            { id: 'w1', x: 0, y: 0, w: 0, h: 2 },
        ];
        expect(validateLayout(layout)).toBe(false);
    });

    it('returns false for non-array input', () => {
        expect(validateLayout(null as unknown as LayoutItem[])).toBe(false);
    });
});

// ============================================================================
// MOBILE LAYOUT TESTS
// ============================================================================

describe('deriveLinkedMobileLayout', () => {
    it('returns empty array for empty input', () => {
        expect(deriveLinkedMobileLayout([])).toEqual([]);
    });

    it('creates stacked mobile layout', () => {
        const result = deriveLinkedMobileLayout(fixtureWidgets);

        // All widgets should be stacked (x=0, w=2)
        result.forEach(w => {
            expect(w.mobileLayout?.x).toBe(0);
            expect(w.mobileLayout?.w).toBe(2);
        });

        // Y positions should be sequential
        let expectedY = 0;
        result.forEach(w => {
            expect(w.mobileLayout?.y).toBe(expectedY);
            expectedY += w.mobileLayout!.h;
        });
    });

    it('preserves desktop-relative reading order (band detection)', () => {
        // Widgets in a row should maintain left-to-right order in mobile
        const widgets: FramerrWidget[] = [
            { id: 'right', type: 'a', layout: { x: 8, y: 0, w: 4, h: 2 }, config: {} },
            { id: 'left', type: 'b', layout: { x: 0, y: 0, w: 4, h: 2 }, config: {} },
            { id: 'middle', type: 'c', layout: { x: 4, y: 0, w: 4, h: 2 }, config: {} },
        ];

        const result = deriveLinkedMobileLayout(widgets);
        const order = result.map(w => w.id);

        expect(order).toEqual(['left', 'middle', 'right']);
    });
});

describe('snapshotToMobileLayout', () => {
    it('adds mobileLayout to widgets without one', () => {
        const result = snapshotToMobileLayout(fixtureWidgets);

        result.forEach(w => {
            expect(w.mobileLayout).toBeDefined();
            expect(w.mobileLayout?.w).toBe(2);
        });
    });

    it('preserves existing mobileLayout', () => {
        const widgets = [
            { ...fixtureWidgets[0], mobileLayout: { x: 0, y: 5, w: 2, h: 3 } },
        ];
        const result = snapshotToMobileLayout(widgets);

        expect(result[0].mobileLayout?.y).toBe(5);
        expect(result[0].mobileLayout?.h).toBe(3);
    });
});

// ============================================================================
// CHANGE DETECTION TESTS
// ============================================================================

describe('isDifferent', () => {
    it('returns false for identical arrays', () => {
        expect(isDifferent(fixtureWidgets, fixtureWidgets)).toBe(false);
    });

    it('returns true for different counts', () => {
        const modified = fixtureWidgets.slice(0, 2);
        expect(isDifferent(modified, fixtureWidgets)).toBe(true);
    });

    it('detects layout changes', () => {
        const modified = fixtureWidgets.map(w =>
            w.id === 'w1' ? { ...w, layout: { ...w.layout, x: 5 } } : w
        );
        expect(isDifferent(modified, fixtureWidgets, { compareLayout: true })).toBe(true);
    });

    it('detects config changes', () => {
        const modified = fixtureWidgets.map(w =>
            w.id === 'w1' ? { ...w, config: { changed: true } } : w
        );
        expect(isDifferent(modified, fixtureWidgets, { compareConfig: true })).toBe(true);
    });

    it('ignores layout changes when compareLayout=false', () => {
        const modified = fixtureWidgets.map(w =>
            w.id === 'w1' ? { ...w, layout: { ...w.layout, x: 5 } } : w
        );
        expect(isDifferent(modified, fixtureWidgets, { compareLayout: false })).toBe(false);
    });
});

describe('getChangedWidgetIds', () => {
    it('returns empty array for identical widgets', () => {
        expect(getChangedWidgetIds(fixtureWidgets, fixtureWidgets)).toEqual([]);
    });

    it('identifies changed widgets', () => {
        const modified = fixtureWidgets.map(w =>
            w.id === 'w2' ? { ...w, layout: { ...w.layout, x: 1 } } : w
        );
        expect(getChangedWidgetIds(modified, fixtureWidgets)).toEqual(['w2']);
    });

    it('identifies new widgets', () => {
        const modified = [...fixtureWidgets, createWidget({ id: 'new' })];
        expect(getChangedWidgetIds(modified, fixtureWidgets)).toContain('new');
    });

    it('identifies deleted widgets', () => {
        const modified = fixtureWidgets.slice(0, 2);
        expect(getChangedWidgetIds(modified, fixtureWidgets)).toContain('w3');
    });
});

describe('widgetSetsMatch', () => {
    it('returns true for same IDs', () => {
        expect(widgetSetsMatch(fixtureWidgets, fixtureWidgets)).toBe(true);
    });

    it('returns true for same IDs in different order', () => {
        const reversed = [...fixtureWidgets].reverse();
        expect(widgetSetsMatch(fixtureWidgets, reversed)).toBe(true);
    });

    it('returns false for different counts', () => {
        const subset = fixtureWidgets.slice(0, 2);
        expect(widgetSetsMatch(fixtureWidgets, subset)).toBe(false);
    });

    it('returns false for different IDs', () => {
        const different = fixtureWidgets.map(w => ({ ...w, id: w.id + '-different' }));
        expect(widgetSetsMatch(fixtureWidgets, different)).toBe(false);
    });
});

// ============================================================================
// UTILITY TESTS
// ============================================================================

describe('getWidgetById', () => {
    it('finds widget by ID', () => {
        const result = getWidgetById(fixtureWidgets, 'w2');
        expect(result?.id).toBe('w2');
        expect(result?.type).toBe('weather');
    });

    it('returns undefined for non-existent ID', () => {
        expect(getWidgetById(fixtureWidgets, 'nonexistent')).toBeUndefined();
    });
});

describe('generateWidgetId', () => {
    it('generates unique IDs', () => {
        const ids = Array.from({ length: 100 }, () => generateWidgetId());
        const unique = new Set(ids);
        expect(unique.size).toBe(100);
    });

    it('starts with widget- prefix', () => {
        expect(generateWidgetId()).toMatch(/^widget-/);
    });
});

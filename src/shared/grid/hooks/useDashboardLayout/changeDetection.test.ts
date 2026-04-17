/**
 * Change Detection — Behavior Lock Tests (BL-2)
 *
 * Tests for the hook-layer unlink decision logic in checkForActualChanges.
 * These characterize the current behavior before refactoring to delegate
 * structural comparison to ops.isDifferent.
 *
 * Run with: npm run test:run -- src/hooks/useDashboardLayout/changeDetection.test.ts
 */

import { describe, it, expect } from 'vitest';
import { checkForActualChanges } from './changeDetection';
import type { FramerrWidget, MobileLayoutMode } from './types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const makeWidget = (overrides: Partial<FramerrWidget> = {}): FramerrWidget => ({
    id: 'w1',
    type: 'clock',
    layout: { x: 0, y: 0, w: 4, h: 2 },
    config: {},
    ...overrides,
});

const baseWidgets: FramerrWidget[] = [
    makeWidget({ id: 'w1', layout: { x: 0, y: 0, w: 4, h: 2 } }),
    makeWidget({ id: 'w2', type: 'weather', layout: { x: 4, y: 0, w: 4, h: 3 } }),
];

// ============================================================================
// BL-2: Unlink Decision Rules
// ============================================================================

describe('checkForActualChanges', () => {
    it('returns shouldUnlink=true for layout change in linked mobile mode — BL-2', () => {
        const modified = baseWidgets.map(w =>
            w.id === 'w1'
                ? { ...w, mobileLayout: { x: 0, y: 0, w: 4, h: 5 } }
                : { ...w, mobileLayout: { ...w.layout } }
        );
        const original = baseWidgets.map(w => ({
            ...w,
            mobileLayout: { ...w.layout },
        }));

        const result = checkForActualChanges(
            modified,
            'sm',
            original,
            [],
            'linked' as MobileLayoutMode,
            false,
            baseWidgets
        );

        expect(result.hasChanges).toBe(true);
        expect(result.shouldUnlink).toBe(true);
    });

    it('returns shouldUnlink=false for config-only change in linked mobile mode — BL-2', () => {
        const modified = baseWidgets.map(w =>
            w.id === 'w1'
                ? { ...w, config: { theme: 'light' } }
                : w
        );

        const result = checkForActualChanges(
            modified,
            'sm',
            baseWidgets,
            [],
            'linked' as MobileLayoutMode,
            false,
            baseWidgets
        );

        expect(result.hasChanges).toBe(true);
        expect(result.shouldUnlink).toBe(false);
    });

    it('returns shouldUnlink=false for layout change in independent mobile mode — BL-2', () => {
        const mobileOriginal = baseWidgets.map(w => ({
            ...w,
            mobileLayout: { x: 0, y: 0, w: 4, h: 2 },
        }));
        const modified = mobileOriginal.map(w =>
            w.id === 'w1'
                ? { ...w, mobileLayout: { x: 0, y: 0, w: 4, h: 5 } }
                : w
        );

        const result = checkForActualChanges(
            modified,
            'sm',
            baseWidgets,
            mobileOriginal,
            'independent' as MobileLayoutMode,
            false,
            baseWidgets
        );

        expect(result.hasChanges).toBe(true);
        expect(result.shouldUnlink).toBe(false);
    });

    it('returns shouldUnlink=false for desktop layout change — BL-2', () => {
        const modified = baseWidgets.map(w =>
            w.id === 'w1'
                ? { ...w, layout: { x: 5, y: 0, w: 4, h: 2 } }
                : w
        );

        const result = checkForActualChanges(
            modified,
            'lg',
            baseWidgets,
            [],
            'linked' as MobileLayoutMode,
            false,
            baseWidgets
        );

        expect(result.hasChanges).toBe(true);
        expect(result.shouldUnlink).toBe(false);
    });

    it('compares against mobileOriginalLayout in independent mode — BL-2', () => {
        const mobileOriginal = baseWidgets.map(w => ({
            ...w,
            mobileLayout: { x: 0, y: 0, w: 4, h: 10 },
        }));
        // Same as mobileOriginal — no changes
        const updated = mobileOriginal.map(w => ({ ...w }));

        const result = checkForActualChanges(
            updated,
            'sm',
            baseWidgets, // different from mobileOriginal — but independent mode should use mobileOriginal
            mobileOriginal,
            'independent' as MobileLayoutMode,
            false,
            baseWidgets
        );

        expect(result.hasChanges).toBe(false);
        expect(result.shouldUnlink).toBe(false);
    });

    it('compares against widgets when pendingUnlink is true — BL-2', () => {
        // When pendingUnlink is true, we compare against widgets (desktop snapshot)
        const desktopWidgets = baseWidgets.map(w => ({
            ...w,
            mobileLayout: { ...w.layout },
        }));
        // Identical to widgets — no changes
        const updated = desktopWidgets.map(w => ({ ...w }));

        const result = checkForActualChanges(
            updated,
            'sm',
            baseWidgets, // would differ, but pendingUnlink overrides
            [],
            'linked' as MobileLayoutMode,
            true, // pendingUnlink
            desktopWidgets
        );

        expect(result.hasChanges).toBe(false);
        expect(result.shouldUnlink).toBe(false);
    });

    it('returns hasChanges=true when widget count differs — BL-2', () => {
        const modified = [baseWidgets[0]]; // Only one widget

        const result = checkForActualChanges(
            modified,
            'lg',
            baseWidgets,
            [],
            'linked' as MobileLayoutMode,
            false,
            baseWidgets
        );

        expect(result.hasChanges).toBe(true);
    });
});

import { describe, it, expect } from 'vitest';
import { resolveWidgetConstraints } from '../resolveWidgetConstraints';
import { GRID_COLS, DEFAULT_MAX_HEIGHT, FIXED_DISPLAY_MAX_H } from '../../../../constants/gridConfig';
import { getWidgetMetadata } from '../../../../widgets/registry';

function modalFallbacks(
    widgetType: string,
    breakpoint: 'lg' | 'sm',
    relaxConstraints: boolean,
) {
    const maxCols = breakpoint === 'sm' ? GRID_COLS.sm : GRID_COLS.lg;
    const effective = resolveWidgetConstraints(widgetType, breakpoint, relaxConstraints);
    const minW = effective.minW ?? 1;
    const maxW = Math.min(effective.maxW ?? maxCols, maxCols);
    const minH = effective.minH ?? 1;
    const maxH = effective.maxH ?? (relaxConstraints ? FIXED_DISPLAY_MAX_H : DEFAULT_MAX_HEIGHT);
    return { minW, maxW, minH, maxH };
}

function legacyInlineDerivation(widgetType: string, isMobile: boolean) {
    const metadata = getWidgetMetadata(widgetType);
    const maxCols = isMobile ? 4 : 24;
    const minW = metadata?.minSize?.w ?? 1;
    const maxW = Math.min(metadata?.maxSize?.w ?? maxCols, maxCols);
    const minH = metadata?.minSize?.h ?? 1;
    const maxH = metadata?.maxSize?.h ?? 20;
    return { minW, maxW, minH, maxH };
}

describe('resolveWidgetConstraints', () => {
    it('lg relax=false returns registry verbatim; unknown type is undefined', () => {
        const clock = resolveWidgetConstraints('clock', 'lg', false);
        expect(clock).toEqual({ minW: 4, maxW: 24, minH: 1, maxH: 6 });

        const unknown = resolveWidgetConstraints('not-a-real-widget-type', 'lg', false);
        expect(unknown).toEqual({
            minW: undefined,
            maxW: undefined,
            minH: undefined,
            maxH: undefined,
        });
    });

    it('relax=true returns empty constraints on lg and sm', () => {
        expect(resolveWidgetConstraints('clock', 'lg', true)).toEqual({});
        expect(resolveWidgetConstraints('clock', 'sm', true)).toEqual({});
    });

    it('sm relax=false uses mobile width stamp + registry height', () => {
        const sm = resolveWidgetConstraints('clock', 'sm', false);
        expect(sm).toEqual({ minW: 1, maxW: GRID_COLS.sm, minH: 1, maxH: 6 });
    });

    it('modal off-mode uses legacy registry widths on lg and sm (not adapter sm 1..4 stamp)', () => {
        // Clock on sm: modal stays registry 4–4; adapter stamp stays 1–4
        expect(legacyInlineDerivation('clock', true)).toEqual({ minW: 4, maxW: 4, minH: 1, maxH: 6 });
        expect(resolveWidgetConstraints('clock', 'sm', false)).toEqual({
            minW: 1,
            maxW: GRID_COLS.sm,
            minH: 1,
            maxH: 6,
        });

        // lg: resolver + modal fallbacks still match legacy registry derivation
        for (const type of ['clock', 'radarr', 'not-a-real-widget-type'] as const) {
            expect(modalFallbacks(type, 'lg', false)).toEqual(legacyInlineDerivation(type, false));
            expect(legacyInlineDerivation(type, true).minW).toBe(
                getWidgetMetadata(type)?.minSize?.w ?? 1,
            );
        }
    });

    it('modalFallbacks with relax=true uses unconstrained floors and FIXED_DISPLAY_MAX_H', () => {
        expect(modalFallbacks('clock', 'lg', true)).toEqual({
            minW: 1,
            maxW: GRID_COLS.lg,
            minH: 1,
            maxH: FIXED_DISPLAY_MAX_H,
        });
        expect(modalFallbacks('clock', 'sm', true)).toEqual({
            minW: 1,
            maxW: GRID_COLS.sm,
            minH: 1,
            maxH: FIXED_DISPLAY_MAX_H,
        });
    });
});

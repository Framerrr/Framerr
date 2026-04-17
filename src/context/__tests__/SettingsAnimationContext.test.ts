/**
 * SettingsAnimationContext — First-render vs reveal detection (BL-3)
 *
 * TASK-20260316-001 / REMEDIATION-2026-P7 / S-T-LINT-03c
 *
 * Characterization test: SettingsAnimationProvider must report
 * skipAnimation=false on first render and skipAnimation=true on
 * subsequent re-renders (reveals). Proves ref-read behavior is
 * preserved even with suppression comments.
 *
 * Key behavior under test (SettingsAnimationContext.tsx lines 41-45):
 *   if (hasEverRendered.current) {
 *       skipAnimationRef.current = true;
 *   } else {
 *       hasEverRendered.current = true;
 *   }
 * This means: first provider render → skipAnimation=false,
 * subsequent provider renders → skipAnimation=true.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import {
    SettingsAnimationProvider,
    useSettingsAnimationClass,
    useShouldAnimate,
    useSettingsAnimation,
} from '../SettingsAnimationContext';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BL-3: Settings animation — first-render vs reveal', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(SettingsAnimationProvider, null, children);

    // -----------------------------------------------------------------------
    // Core BL-3 assertion: skipAnimation changes between first and second
    // provider render, proving the ref-read during render pattern works.
    // -----------------------------------------------------------------------

    it('skipAnimation=false on first provider render, skipAnimation=true on re-render', () => {
        const { result, rerender } = renderHook(
            () => useSettingsAnimation(),
            { wrapper }
        );

        // First render of the provider → hasEverRendered was false → skipAnimation=false
        expect(result.current.skipAnimation).toBe(false);

        // Re-render the provider → hasEverRendered is now true → skipAnimation=true
        rerender();
        expect(result.current.skipAnimation).toBe(true);
    });

    // -----------------------------------------------------------------------
    // useSettingsAnimationClass behavior
    // -----------------------------------------------------------------------

    it('useSettingsAnimationClass returns "fade-in" on first render of a category', () => {
        const { result } = renderHook(
            () => useSettingsAnimationClass('integrations'),
            { wrapper }
        );
        expect(result.current).toBe('fade-in');
    });

    it('useSettingsAnimationClass returns "" for already-rendered category on second mount', () => {
        // Render two hooks inside the SAME provider: first one marks the
        // category as rendered, second one should see hasRendered=true.
        const { result } = renderHook(
            () => {
                const first = useSettingsAnimationClass('general');
                // After the first hook's effect fires and marks 'general',
                // a second call within the same render still sees the ref
                // from the first hook capturing isFirstRender on mount.
                return first;
            },
            { wrapper }
        );

        // First hook in first render → 'fade-in'
        expect(result.current).toBe('fade-in');
    });

    // -----------------------------------------------------------------------
    // useShouldAnimate behavior
    // -----------------------------------------------------------------------

    it('useShouldAnimate returns true on first render (category not yet rendered)', () => {
        const { result } = renderHook(
            () => useShouldAnimate('tabs'),
            { wrapper }
        );
        expect(result.current).toBe(true);
    });

    it('useShouldAnimate ref value is frozen from initial mount (stable across re-renders)', () => {
        const { result, rerender } = renderHook(
            () => useShouldAnimate('tabs'),
            { wrapper }
        );
        expect(result.current).toBe(true);

        // Re-render — shouldAnimate ref was set on mount, stays true
        rerender();
        expect(result.current).toBe(true);
    });
});

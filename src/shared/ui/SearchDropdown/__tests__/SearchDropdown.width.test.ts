/**
 * SearchDropdown — Width matching (BL-5)
 *
 * TASK-20260316-001 / REMEDIATION-2026-P7 / S-T-LINT-03c
 *
 * Characterization test: SearchDropdown reads anchorWrapperRef.current
 * during render to compute popover width. Verifies that the ref-read
 * DOM measurement pattern works correctly even with suppression comments.
 *
 * Key behavior under test (SearchDropdown.tsx lines 162-166):
 *   const anchorWidth = anchorWrapperRef.current?.offsetWidth;
 *   const popoverWidth = anchorWidth && maxWidth
 *       ? Math.min(anchorWidth, maxWidth)
 *       : anchorWidth;
 * This width is then passed to the Popover.Content style.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../hooks/useCloseOnScroll', () => ({
    useCloseOnScroll: vi.fn(),
}));

vi.mock('../../../../hooks/useOverlayScrollLock', () => ({
    useOverlayScrollLock: vi.fn(),
}));

// Track what style.width gets passed to Popover.Content
let capturedContentStyle: React.CSSProperties | undefined;

// Mock Radix Popover to capture the width passed to Content
vi.mock('@radix-ui/react-popover', () => ({
    Root: ({ children }: { children: React.ReactNode }) =>
        React.createElement('div', { 'data-testid': 'popover-root' }, children),
    Anchor: ({ children }: { children: React.ReactNode; asChild?: boolean }) =>
        React.createElement('div', { 'data-testid': 'popover-anchor' }, children),
    Portal: ({ children }: { children: React.ReactNode }) =>
        React.createElement('div', null, children),
    Content: React.forwardRef(
        ({ children, style, ...props }: { children: React.ReactNode; style?: React.CSSProperties }, ref: React.Ref<HTMLDivElement>) => {
            // Capture the style.width actually passed by SearchDropdown
            capturedContentStyle = style;
            return React.createElement('div', { ref, style, 'data-testid': 'popover-content', ...props }, children);
        }
    ),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: React.forwardRef(({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<HTMLDivElement>) =>
            React.createElement('div', { ref, ...props }, children)
        ),
    },
}));

// Mock animations
vi.mock('../../animations', () => ({
    popIn: { hidden: {}, visible: {}, exit: {} },
}));

import { SearchDropdown } from '../SearchDropdown';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BL-5: SearchDropdown — anchor width measurement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedContentStyle = undefined;
    });

    it('renders without crashing when open=false', () => {
        const { container } = render(
            React.createElement(SearchDropdown, {
                open: false,
                onOpenChange: vi.fn(),
                anchor: React.createElement('input', { placeholder: 'Search...' }),
                children: React.createElement('div', null, 'Items'),
            })
        );

        expect(container.querySelector('input')).toBeTruthy();
    });

    it('renders the anchor element in the measurable wrapper div', () => {
        const { container } = render(
            React.createElement(SearchDropdown, {
                open: false,
                onOpenChange: vi.fn(),
                anchor: React.createElement('input', {
                    'data-testid': 'search-anchor',
                    placeholder: 'Search...',
                }),
                children: React.createElement('div', null, 'Items'),
            })
        );

        const anchor = container.querySelector('[data-testid="search-anchor"]');
        expect(anchor).toBeTruthy();
        // Anchor should be wrapped in the anchorWrapperRef div
        const wrapper = anchor?.closest('.search-dropdown-anchor');
        expect(wrapper).toBeTruthy();
    });

    it('passes anchorWrapperRef.current.offsetWidth as popover content width when open', () => {
        // First render with open=false to get the anchor wrapper mounted
        const onOpenChange = vi.fn();
        const { container, rerender } = render(
            React.createElement(SearchDropdown, {
                open: false,
                onOpenChange,
                anchor: React.createElement('input', { placeholder: 'Search...' }),
                children: React.createElement('div', null, 'Items'),
            })
        );

        // Mock the offsetWidth on the anchor wrapper div
        const wrapperDiv = container.querySelector('.search-dropdown-anchor');
        expect(wrapperDiv).toBeTruthy();
        Object.defineProperty(wrapperDiv!, 'offsetWidth', { value: 350, configurable: true });

        // Re-render with open=true — SearchDropdown reads anchorWrapperRef.current.offsetWidth
        // during render and passes it as style.width to Popover.Content
        rerender(
            React.createElement(SearchDropdown, {
                open: true,
                onOpenChange,
                anchor: React.createElement('input', { placeholder: 'Search...' }),
                children: React.createElement('div', null, 'Items'),
            })
        );

        // The captured style should have the measured width
        expect(capturedContentStyle).toBeDefined();
        expect(capturedContentStyle!.width).toBe(350);
    });

    it('clamps popover width to maxWidth when anchor is wider', () => {
        const onOpenChange = vi.fn();
        const { container, rerender } = render(
            React.createElement(SearchDropdown, {
                open: false,
                onOpenChange,
                maxWidth: 200,
                anchor: React.createElement('input', { placeholder: 'Search...' }),
                children: React.createElement('div', null, 'Items'),
            })
        );

        // Mock wide anchor
        const wrapperDiv = container.querySelector('.search-dropdown-anchor');
        expect(wrapperDiv).toBeTruthy();
        Object.defineProperty(wrapperDiv!, 'offsetWidth', { value: 500, configurable: true });

        // Re-render open — should clamp to maxWidth
        rerender(
            React.createElement(SearchDropdown, {
                open: true,
                onOpenChange,
                maxWidth: 200,
                anchor: React.createElement('input', { placeholder: 'Search...' }),
                children: React.createElement('div', null, 'Items'),
            })
        );

        // popoverWidth = Math.min(500, 200) = 200
        expect(capturedContentStyle).toBeDefined();
        expect(capturedContentStyle!.width).toBe(200);
    });
});

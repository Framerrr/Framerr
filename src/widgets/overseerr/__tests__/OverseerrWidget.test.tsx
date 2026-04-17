/**
 * OverseerrWidget — Preview Characterization Tests (Behavior Lock)
 *
 * TASK-20260308-006 / REMEDIATION-2026-P5 / S-W-MEDIA-05
 *
 * These tests lock preview-mode rendering behavior after the hardcoded
 * value cleanup. Preview mode early-returns before hooks, so minimal mocking
 * is needed.
 *
 * BTP Map:
 *   BTP-1 — Preview renders all 4 mock request cards
 *   BTP-2 — Poster gradients use CSS variables
 *   BTP-3 — Film icons use text-theme-primary, not text-white
 *   BTP-4 — Title text preserves text-white on dark overlay
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../test/providers';
import OverseerrWidget from '../OverseerrWidget';
import type { WidgetData } from '../../types';

vi.mock('../../../context/AuthContext', () => ({
    useAuth: () => ({ user: { role: 'admin' } }),
}));
vi.mock('../../../utils/permissions', () => ({ isAdmin: () => true }));

function makeWidget(overrides?: Partial<WidgetData>): WidgetData {
    return { id: 'test-1', type: 'overseerr', x: 0, y: 0, w: 4, h: 4, config: {}, ...overrides };
}

function renderPreview() {
    return render(
        <OverseerrWidget widget={makeWidget()} isEditMode={false} previewMode={true} />,
        { wrapper: AllProviders },
    );
}

describe('OverseerrWidget — Preview Characterization', () => {
    // BTP-1: Preview renders all 4 mock request cards
    it('renders all 4 preview request titles', () => {
        renderPreview();
        expect(screen.getByText('Dune: Part Two')).toBeInTheDocument();
        expect(screen.getByText('Oppenheimer')).toBeInTheDocument();
        expect(screen.getByText('The Bear S4')).toBeInTheDocument();
        expect(screen.getByText('Barbie')).toBeInTheDocument();
    });

    // BTP-2: Poster gradients use CSS variables
    it('preview poster backgrounds use --gradient-N variables in linear-gradient', () => {
        const { container } = renderPreview();
        // Each poster card has a div with inline background style
        const posterBgs = container.querySelectorAll('[style*="background"]');
        // Filter to those containing gradient (exclude status badges)
        const gradientEls = Array.from(posterBgs).filter(el =>
            (el.getAttribute('style') || '').includes('linear-gradient')
        );
        expect(gradientEls.length).toBe(4);
        gradientEls.forEach(el => {
            const style = el.getAttribute('style') || '';
            expect(style).toContain('var(--gradient-');
            expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
        });
    });

    // BTP-3: Film icons use text-theme-primary, not text-white
    it('preview Film icons use text-theme-primary, not text-white', () => {
        const { container } = renderPreview();
        const icons = container.querySelectorAll('svg');
        icons.forEach(icon => {
            const classes = icon.getAttribute('class') || '';
            expect(classes).toContain('text-theme-primary');
            expect(classes).not.toContain('text-white');
        });
    });

    // BTP-4: Title text preserves text-white on dark overlay
    it('preview title text retains text-white for dark overlay contrast', () => {
        renderPreview();
        const title = screen.getByText('Dune: Part Two');
        expect(title.className).toContain('text-white');
    });
});

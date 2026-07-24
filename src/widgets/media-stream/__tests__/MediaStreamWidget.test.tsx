/**
 * MediaStreamWidget — Preview Characterization Tests (Behavior Lock)
 *
 * TASK-20260308-006 / REMEDIATION-2026-P5 / S-W-MEDIA-05
 *
 * These tests lock preview-mode rendering behavior after the hardcoded
 * value cleanup. Preview mode early-returns before hooks, so minimal mocking
 * is needed.
 *
 * BTP Map:
 *   BTP-1 — Preview renders mock content (titles visible)
 *   BTP-2 — Preview gradient uses CSS variables, not hardcoded hex
 *   BTP-3 — Preview icon uses text-theme-primary, not text-white
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../test/providers';
import MediaStreamWidget from '../MediaStreamWidget';
import type { WidgetData } from '../../types';

// Minimal mocks — preview mode early-returns before hooks
vi.mock('../../../context/useAuth', () => ({
    useAuth: () => ({ user: { role: 'admin' } }),
}));
vi.mock('../../../utils/permissions', () => ({ isAdmin: () => true }));

function makeWidget(overrides?: Partial<WidgetData>): WidgetData {
    return { id: 'test-1', type: 'media-stream', x: 0, y: 0, w: 4, h: 4, config: {}, ...overrides };
}

function renderPreview() {
    return render(
        <MediaStreamWidget widget={makeWidget()} previewMode={true} />,
        { wrapper: AllProviders },
    );
}

describe('MediaStreamWidget — Preview Characterization', () => {
    // BTP-1: Preview renders mock content only
    it('renders mock session titles in preview mode', () => {
        renderPreview();
        expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
        expect(screen.getByText('The Office')).toBeInTheDocument();
    });

    // BTP-2: Preview gradient uses CSS variables, not hardcoded hex
    it('preview placeholder uses CSS variable gradient, not hardcoded hex', () => {
        const { container } = renderPreview();
        const placeholder = container.querySelector('.plex-card__placeholder');
        expect(placeholder).not.toBeNull();
        const bg = (placeholder as HTMLElement).style.background;
        expect(bg).toContain('var(--gradient-');
        expect(bg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    });

    // BTP-3: Preview icon uses theme class, not text-white
    it('preview Film icon uses text-theme-primary, not text-white', () => {
        const { container } = renderPreview();
        const svg = container.querySelector('.plex-card__placeholder svg');
        expect(svg).not.toBeNull();
        const classes = svg!.getAttribute('class') || '';
        expect(classes).toContain('text-theme-primary');
        expect(classes).not.toContain('text-white');
    });
});

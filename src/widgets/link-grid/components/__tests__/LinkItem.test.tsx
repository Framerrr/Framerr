/**
 * LinkItem — TASK-20260727-004
 *
 * Regression guards for full tile parity (.no-drag removal, button → div),
 * edit-mode click/keyboard, view-mode keyboard on action tiles, and
 * drag-leak click suppression wiring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { LinkItem } from '../LinkItem';
import type { Link, LinkPosition } from '../../types';

const mockExecute = vi.fn();
const mockOnLinkClick = vi.fn();

vi.mock('../../hooks/useLinkAction', () => ({
    useLinkAction: vi.fn(() => ({ state: 'idle', execute: mockExecute })),
}));

vi.mock('../../../../context/ActiveDashboardContext', () => ({
    useActiveDashboard: () => ({ switchDashboard: vi.fn() }),
}));

const consumeGridDragSuppression = vi.fn((_originEl: Element | null) => false);

vi.mock('../../../../utils/gridDragClickSuppression', () => ({
    consumeGridDragSuppression: (originEl: Element | null) => consumeGridDragSuppression(originEl),
}));

vi.mock('../../../../utils/haptics', () => ({
    triggerHaptic: vi.fn(),
}));

import { useLinkAction } from '../../hooks/useLinkAction';

const defaultPosition: LinkPosition = {
    linkId: 'link-1',
    gridCol: 0,
    gridRow: 0,
    gridColSpan: 1,
    gridRowSpan: 1,
};

function makeLink(overrides: Partial<Link> = {}): Link {
    return {
        id: 'link-1',
        title: 'Test Link',
        icon: 'link',
        size: 'circle',
        type: 'link',
        url: 'https://example.com',
        ...overrides,
    };
}

function renderLinkItem(
    link: Link,
    editMode: boolean,
    onLinkClick = mockOnLinkClick,
) {
    return render(
        <LinkItem
            link={link}
            position={defaultPosition}
            cellSize={64}
            gridGap={8}
            editMode={editMode}
            editingLinkId={null}
            onLinkClick={onLinkClick}
        />,
    );
}

describe('LinkItem — TASK-20260727-004', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        consumeGridDragSuppression.mockReturnValue(false);
        vi.mocked(useLinkAction).mockReturnValue({ state: 'idle', execute: mockExecute });
    });

    describe('edit mode — class/tag parity', () => {
        it('renders link tile without no-drag, with edit-clickable', () => {
            const { container } = renderLinkItem(makeLink({ type: 'link' }), true);
            const anchor = container.querySelector('a');
            expect(anchor).toBeTruthy();
            expect(anchor!.className).not.toContain('no-drag');
            expect(anchor!.className).toContain('edit-clickable');
        });

        it('renders action tile as div[role=button] without no-drag', () => {
            const { container } = renderLinkItem(
                makeLink({
                    type: 'action',
                    action: { method: 'GET', url: 'https://api.example.com/trigger' },
                }),
                true,
            );
            const tile = container.querySelector('[role="button"]');
            expect(tile).toBeTruthy();
            expect(tile!.tagName).toBe('DIV');
            expect(tile!.className).not.toContain('no-drag');
        });
    });

    describe('edit mode — click opens editor', () => {
        it('link tile click calls onLinkClick', () => {
            const { container } = renderLinkItem(makeLink({ type: 'link' }), true);
            fireEvent.click(container.querySelector('a')!);
            expect(mockOnLinkClick).toHaveBeenCalledWith('link-1');
        });

        it('action tile click calls onLinkClick', () => {
            const { container } = renderLinkItem(
                makeLink({
                    type: 'action',
                    action: { method: 'GET', url: 'https://api.example.com/trigger' },
                }),
                true,
            );
            fireEvent.click(container.querySelector('[role="button"]')!);
            expect(mockOnLinkClick).toHaveBeenCalledWith('link-1');
            expect(mockExecute).not.toHaveBeenCalled();
        });
    });

    describe('edit mode — action tile keyboard', () => {
        const actionLink = makeLink({
            type: 'action',
            action: { method: 'GET', url: 'https://api.example.com/trigger' },
        });

        it('Enter calls onLinkClick', () => {
            const { container } = renderLinkItem(actionLink, true);
            fireEvent.keyDown(container.querySelector('[role="button"]')!, { key: 'Enter' });
            expect(mockOnLinkClick).toHaveBeenCalledWith('link-1');
        });

        it('Space calls onLinkClick', () => {
            const { container } = renderLinkItem(actionLink, true);
            fireEvent.keyDown(container.querySelector('[role="button"]')!, { key: ' ' });
            expect(mockOnLinkClick).toHaveBeenCalledWith('link-1');
        });
    });

    describe('view mode — action tile keyboard (PLAN_REVIEW §7)', () => {
        const actionLink = makeLink({
            type: 'action',
            action: { method: 'GET', url: 'https://api.example.com/trigger' },
        });

        it('Enter calls executeAction, not onLinkClick', () => {
            const { container } = renderLinkItem(actionLink, false);
            fireEvent.keyDown(container.querySelector('[role="button"]')!, { key: 'Enter' });
            expect(mockExecute).toHaveBeenCalled();
            expect(mockOnLinkClick).not.toHaveBeenCalled();
        });

        it('Space calls executeAction, not onLinkClick', () => {
            const { container } = renderLinkItem(actionLink, false);
            fireEvent.keyDown(container.querySelector('[role="button"]')!, { key: ' ' });
            expect(mockExecute).toHaveBeenCalled();
            expect(mockOnLinkClick).not.toHaveBeenCalled();
        });
    });

    describe('edit mode — link tile keyboard', () => {
        it('has tabIndex 0 in edit mode', () => {
            const { container } = renderLinkItem(makeLink({ type: 'link' }), true);
            expect(container.querySelector('a')).toHaveAttribute('tabindex', '0');
        });

        it('Enter calls onLinkClick', () => {
            const { container } = renderLinkItem(makeLink({ type: 'link' }), true);
            fireEvent.keyDown(container.querySelector('a')!, { key: 'Enter' });
            expect(mockOnLinkClick).toHaveBeenCalledWith('link-1');
        });

        it('Space calls onLinkClick', () => {
            const { container } = renderLinkItem(makeLink({ type: 'link' }), true);
            fireEvent.keyDown(container.querySelector('a')!, { key: ' ' });
            expect(mockOnLinkClick).toHaveBeenCalledWith('link-1');
        });

        it('view mode keydown does not call onLinkClick', () => {
            const { container } = renderLinkItem(makeLink({ type: 'link' }), false);
            fireEvent.keyDown(container.querySelector('a')!, { key: 'Enter' });
            expect(mockOnLinkClick).not.toHaveBeenCalled();
        });
    });

    describe('action tile loading/disabled state', () => {
        beforeEach(() => {
            vi.mocked(useLinkAction).mockReturnValue({ state: 'loading', execute: mockExecute });
        });

        it('click does not call onLinkClick or executeAction when loading', () => {
            const { container } = renderLinkItem(
                makeLink({
                    type: 'action',
                    action: { method: 'GET', url: 'https://api.example.com/trigger' },
                }),
                true,
            );
            const tile = container.querySelector('[role="button"]')!;
            fireEvent.click(tile);
            expect(mockOnLinkClick).not.toHaveBeenCalled();
            expect(mockExecute).not.toHaveBeenCalled();
        });

        it('has aria-disabled and tabIndex -1 when loading', () => {
            const { container } = renderLinkItem(
                makeLink({
                    type: 'action',
                    action: { method: 'GET', url: 'https://api.example.com/trigger' },
                }),
                true,
            );
            const tile = container.querySelector('[role="button"]')!;
            expect(tile).toHaveAttribute('aria-disabled', 'true');
            expect(tile).toHaveAttribute('tabindex', '-1');
        });
    });

    describe('view mode — link tile click unchanged', () => {
        it('click does not call onLinkClick', () => {
            const { container } = renderLinkItem(makeLink({ type: 'link' }), false);
            fireEvent.click(container.querySelector('a')!);
            expect(mockOnLinkClick).not.toHaveBeenCalled();
        });
    });

    describe('drag-leak guard integration', () => {
        it('link tile: suppresses onLinkClick when consume returns true', () => {
            consumeGridDragSuppression.mockReturnValue(true);
            const { container } = renderLinkItem(makeLink({ type: 'link' }), true);
            fireEvent.click(container.querySelector('a')!);
            expect(mockOnLinkClick).not.toHaveBeenCalled();
        });

        it('link tile: calls onLinkClick when consume returns false', () => {
            consumeGridDragSuppression.mockReturnValue(false);
            const { container } = renderLinkItem(makeLink({ type: 'link' }), true);
            fireEvent.click(container.querySelector('a')!);
            expect(mockOnLinkClick).toHaveBeenCalledWith('link-1');
        });

        it('action tile: suppresses onLinkClick when consume returns true', () => {
            consumeGridDragSuppression.mockReturnValue(true);
            const { container } = renderLinkItem(
                makeLink({
                    type: 'action',
                    action: { method: 'GET', url: 'https://api.example.com/trigger' },
                }),
                true,
            );
            fireEvent.click(container.querySelector('[role="button"]')!);
            expect(mockOnLinkClick).not.toHaveBeenCalled();
        });

        it('action tile: calls onLinkClick when consume returns false', () => {
            consumeGridDragSuppression.mockReturnValue(false);
            const { container } = renderLinkItem(
                makeLink({
                    type: 'action',
                    action: { method: 'GET', url: 'https://api.example.com/trigger' },
                }),
                true,
            );
            fireEvent.click(container.querySelector('[role="button"]')!);
            expect(mockOnLinkClick).toHaveBeenCalledWith('link-1');
        });
    });
});

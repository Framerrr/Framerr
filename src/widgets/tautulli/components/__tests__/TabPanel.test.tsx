/**
 * TabPanel — post-microtask width (BL-W0-11)
 *
 * TASK-20260722-001 / REMEDIATION-2026-P7 / S-T-LINT-04
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import TabPanel from '../TabPanel';
import { splitFeatured } from '../../featuredLayout';

vi.mock('../FeaturedBand', () => ({
    default: () => <div data-testid="featured-band" />,
}));
vi.mock('../RemainderList', () => ({
    default: () => <div data-testid="remainder-list" />,
}));
vi.mock('../../featuredLayout', async () => {
    const actual = await vi.importActual<typeof import('../../featuredLayout')>('../../featuredLayout');
    return {
        ...actual,
        splitFeatured: vi.fn(actual.splitFeatured),
    };
});

const mockRows = Array.from({ length: 4 }, (_, i) => ({
    key: `row-${i}`,
    title: `Title ${i}`,
    subtitle: `Sub ${i}`,
    meta: `${i + 1}`,
    featuredImageUrl: null,
    featuredFallbackUrl: null,
    listImageUrl: null,
    variant: 'content' as const,
}));

describe('BL-W0-11: TabPanel initial width after microtask', () => {
    beforeEach(() => {
        vi.mocked(splitFeatured).mockClear();
    });

    it('passes root clientWidth to splitFeatured after mount microtask', async () => {
        const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
            configurable: true,
            get() {
                return 640;
            },
        });

        render(
            <TabPanel rows={mockRows} listLimit={10} emptyLabel="Nothing here" />,
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(splitFeatured).toHaveBeenCalled();
        const lastCall = vi.mocked(splitFeatured).mock.calls.at(-1);
        expect(lastCall?.[1]).toBe(640);

        if (originalDescriptor) {
            Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalDescriptor);
        } else {
            delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
        }
    });
});

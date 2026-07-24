/**
 * MovieDetailModal — Interactive Search state locks (L1–L4)
 *
 * TASK-20260723-003
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../../test/providers';
import MovieDetailModal from '../MovieDetailModal';
import type { WantedMovie, RadarrRelease } from '../../radarr.types';

const movieA = { id: 1, title: 'Movie A', hasFile: false } as WantedMovie;
const movieB = { id: 2, title: 'Movie B', hasFile: false } as WantedMovie;

const releaseA: RadarrRelease = {
    guid: 'g1',
    title: 'Release 1',
    indexerId: 1,
    quality: { quality: { id: 1, name: 'HD' } },
    size: 1,
    protocol: 'usenet',
};

function makeProps(overrides?: Partial<React.ComponentProps<typeof MovieDetailModal>>) {
    return {
        movie: movieA,
        integrationId: 'test',
        open: true,
        onOpenChange: vi.fn(),
        triggerAutoSearch: vi.fn().mockResolvedValue(true),
        searchReleases: vi.fn().mockResolvedValue([releaseA]),
        grabRelease: vi.fn().mockResolvedValue(true),
        userIsAdmin: true,
        ...overrides,
    };
}

async function runInteractiveSearchToResults(
    searchReleases = vi.fn().mockResolvedValue([releaseA]),
) {
    const props = makeProps({ searchReleases });
    const view = render(<MovieDetailModal {...props} />, { wrapper: AllProviders });
    fireEvent.click(screen.getByText('Interactive Search'));
    await screen.findByText(/1 release/);
    return { ...view, props };
}

describe('MovieDetailModal Interactive Search state', () => {
    it('L1: same-title close→reopen preserves results', async () => {
        const { rerender, props } = await runInteractiveSearchToResults();

        rerender(
            <MovieDetailModal {...props} open={false} />,
        );
        rerender(
            <MovieDetailModal {...props} open={true} />,
        );

        expect(screen.getByText(/1 release/)).toBeInTheDocument();
        expect(screen.getByText('Release 1')).toBeInTheDocument();
    });

    it('L2: id change resets to info and clears prior releases', async () => {
        const { rerender, props } = await runInteractiveSearchToResults();

        rerender(
            <MovieDetailModal {...props} movie={movieB} />,
        );

        expect(screen.getByText('Movie B')).toBeInTheDocument();
        expect(screen.queryByText('Release 1')).toBeNull();
        expect(screen.queryByText(/1 release/)).toBeNull();
    });

    it('L3: A→B→A shows fresh info for A (not old results)', async () => {
        const { rerender, props } = await runInteractiveSearchToResults();

        rerender(
            <MovieDetailModal {...props} movie={movieB} />,
        );
        expect(screen.getByText('Movie B')).toBeInTheDocument();

        rerender(
            <MovieDetailModal {...props} movie={movieA} />,
        );

        expect(screen.getByText('Movie A')).toBeInTheDocument();
        expect(screen.queryByText('Release 1')).toBeNull();
        expect(screen.queryByText(/1 release/)).toBeNull();
    });

    it('L4: in-flight search from A is ignored after switch to B', async () => {
        let resolveSearch: (value: RadarrRelease[]) => void = () => {};
        const searchReleases = vi.fn(
            () =>
                new Promise<RadarrRelease[]>((resolve) => {
                    resolveSearch = resolve;
                }),
        );
        const props = makeProps({ searchReleases });
        const { rerender } = render(<MovieDetailModal {...props} />, { wrapper: AllProviders });

        fireEvent.click(screen.getByText('Interactive Search'));
        expect(screen.getByText('Searching indexers…')).toBeInTheDocument();

        rerender(
            <MovieDetailModal {...props} movie={movieB} />,
        );
        expect(screen.getByText('Movie B')).toBeInTheDocument();

        resolveSearch([releaseA]);
        await waitFor(() => {
            expect(screen.queryByText('Release 1')).toBeNull();
        });
        expect(screen.getByText('Movie B')).toBeInTheDocument();
        expect(screen.queryByText(/1 release/)).toBeNull();
    });
});

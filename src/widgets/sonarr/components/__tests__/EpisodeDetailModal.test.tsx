/**
 * EpisodeDetailModal — Interactive Search state locks (L1–L4)
 *
 * TASK-20260723-003
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../../test/providers';
import EpisodeDetailModal from '../EpisodeDetailModal';
import type { WantedEpisode, SonarrRelease } from '../../sonarr.types';

const episodeA = {
    id: 1,
    title: 'Ep A',
    hasFile: false,
    series: { title: 'Series A' },
} as WantedEpisode;

const episodeB = {
    id: 2,
    title: 'Ep B',
    hasFile: false,
    series: { title: 'Series B' },
} as WantedEpisode;

const releaseA: SonarrRelease = {
    guid: 'g1',
    title: 'Release 1',
    indexerId: 1,
    quality: { quality: { id: 1, name: 'HD' } },
    size: 1,
    protocol: 'usenet',
};

function makeProps(overrides?: Partial<React.ComponentProps<typeof EpisodeDetailModal>>) {
    return {
        episode: episodeA,
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
    const view = render(<EpisodeDetailModal {...props} />, { wrapper: AllProviders });
    fireEvent.click(screen.getByText('Interactive Search'));
    await screen.findByText(/1 release/);
    return { ...view, props };
}

describe('EpisodeDetailModal Interactive Search state', () => {
    it('L1: same-title close→reopen preserves results', async () => {
        const { rerender, props } = await runInteractiveSearchToResults();

        rerender(
            <EpisodeDetailModal {...props} open={false} />,
        );
        rerender(
            <EpisodeDetailModal {...props} open={true} />,
        );

        expect(screen.getByText(/1 release/)).toBeInTheDocument();
        expect(screen.getByText('Release 1')).toBeInTheDocument();
    });

    it('L2: id change resets to info and clears prior releases', async () => {
        const { rerender, props } = await runInteractiveSearchToResults();

        rerender(
            <EpisodeDetailModal {...props} episode={episodeB} />,
        );

        expect(screen.getByText('Ep B')).toBeInTheDocument();
        expect(screen.queryByText('Release 1')).toBeNull();
        expect(screen.queryByText(/1 release/)).toBeNull();
    });

    it('L3: A→B→A shows fresh info for A (not old results)', async () => {
        const { rerender, props } = await runInteractiveSearchToResults();

        rerender(
            <EpisodeDetailModal {...props} episode={episodeB} />,
        );
        expect(screen.getByText('Ep B')).toBeInTheDocument();

        rerender(
            <EpisodeDetailModal {...props} episode={episodeA} />,
        );

        expect(screen.getByText('Ep A')).toBeInTheDocument();
        expect(screen.queryByText('Release 1')).toBeNull();
        expect(screen.queryByText(/1 release/)).toBeNull();
    });

    it('L4: in-flight search from A is ignored after switch to B', async () => {
        let resolveSearch: (value: SonarrRelease[]) => void = () => {};
        const searchReleases = vi.fn(
            () =>
                new Promise<SonarrRelease[]>((resolve) => {
                    resolveSearch = resolve;
                }),
        );
        const props = makeProps({ searchReleases });
        const { rerender } = render(<EpisodeDetailModal {...props} />, { wrapper: AllProviders });

        fireEvent.click(screen.getByText('Interactive Search'));
        expect(screen.getByText('Searching indexers…')).toBeInTheDocument();

        rerender(
            <EpisodeDetailModal {...props} episode={episodeB} />,
        );
        expect(screen.getByText('Ep B')).toBeInTheDocument();

        resolveSearch([releaseA]);
        await waitFor(() => {
            expect(screen.queryByText('Release 1')).toBeNull();
        });
        expect(screen.getByText('Ep B')).toBeInTheDocument();
        expect(screen.queryByText(/1 release/)).toBeNull();
    });
});

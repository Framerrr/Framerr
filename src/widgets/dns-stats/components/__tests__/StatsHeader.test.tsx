/**
 * StatsHeader — pause badge / Resuming. copy
 * TASK-20260726-002
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import StatsHeader from '../StatsHeader';
import type { DnsStatsData } from '../../api.types';

function makeData(overrides: Partial<DnsStatsData>): DnsStatsData {
    return {
        queriesTotal: 100,
        queriesBlocked: 10,
        blockedPercent: 10,
        domainsOnList: 50,
        protectionEnabled: true,
        pauseRemaining: null,
        avgProcessingTimeMs: null,
        activeClients: null,
        topBlockedDomains: [],
        topQueriedDomains: [],
        topClients: [],
        topUpstreams: [],
        sparkline: [],
        ...overrides,
    };
}

describe('StatsHeader pause badge', () => {
    it('renders countdown when paused with remaining seconds', () => {
        render(
            <StatsHeader
                data={makeData({ protectionEnabled: false, pauseRemaining: 45 })}
            />,
        );
        expect(screen.getByText(/Paused · 45s remaining/)).toBeInTheDocument();
    });

    it('renders Resuming... when local countdown is zero while still disabled', () => {
        render(
            <StatsHeader
                data={makeData({ protectionEnabled: false, pauseRemaining: 0 })}
            />,
        );
        expect(screen.getByText('Resuming...')).toBeInTheDocument();
    });

    it('hides pause badge when protection is enabled', () => {
        render(
            <StatsHeader
                data={makeData({ protectionEnabled: true, pauseRemaining: null })}
            />,
        );
        expect(screen.queryByText(/Paused/)).not.toBeInTheDocument();
        expect(screen.queryByText('Resuming...')).not.toBeInTheDocument();
    });
});

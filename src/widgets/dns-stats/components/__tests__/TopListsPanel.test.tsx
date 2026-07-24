/**
 * TopListsPanel — active-tab normalization (BL-W0T-2)
 *
 * TASK-20260722-002 / REMEDIATION-2026-P7 / S-T-LINT-04b
 */

import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import TopListsPanel from '../TopListsPanel';
import type { DnsStatsData } from '../../api.types';

const mockData: DnsStatsData = {
    queriesTotal: 100,
    queriesBlocked: 10,
    blockedPercent: 10,
    domainsOnList: 50,
    protectionEnabled: true,
    pauseRemaining: null,
    avgProcessingTimeMs: 5,
    activeClients: 2,
    topBlockedDomains: [{ domain: 'blocked.example.com', count: 5 }],
    topQueriedDomains: [{ domain: 'queried.example.com', count: 8 }],
    topClients: [{ name: 'client.local', count: 3 }],
    topUpstreams: [{ name: '1.1.1.1', count: 20, avgResponseMs: 12 }],
    sparkline: [],
};

describe('BL-W0T-2: TopListsPanel active-tab normalization', () => {
    it('normalizes to first valid tab after microtask when active tab becomes invalid', async () => {
        const { rerender } = render(
            <TopListsPanel
                data={mockData}
                showTopBlocked
                showTopQueried
                showTopClients={false}
                showTopUpstreams={false}
            />,
        );

        expect(screen.getByText('blocked.example.com')).toBeInTheDocument();

        rerender(
            <TopListsPanel
                data={mockData}
                showTopBlocked={false}
                showTopQueried
                showTopClients={false}
                showTopUpstreams={false}
            />,
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByText('queried.example.com')).toBeInTheDocument();
        expect(screen.queryByText('blocked.example.com')).not.toBeInTheDocument();
    });
});

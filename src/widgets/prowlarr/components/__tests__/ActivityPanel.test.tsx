/**
 * ActivityPanel — load-on-activate timing (BL-W0-10)
 *
 * TASK-20260722-001 / REMEDIATION-2026-P7 / S-T-LINT-04
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import ActivityPanel from '../ActivityPanel';

describe('BL-W0-10: ActivityPanel load-on-activate', () => {
    it('calls fetchActivity exactly once when active becomes true', async () => {
        const fetchActivity = vi.fn().mockResolvedValue({
            history: [{ id: 1, indexerName: 'Test', eventLabel: 'Query', detail: '', date: new Date().toISOString(), successful: true }],
            stats: { queries: 1, grabs: 1, avgResponseMs: 12 },
            error: null,
        });

        const { rerender } = render(
            <ActivityPanel fetchActivity={fetchActivity} active={false} />,
        );
        expect(fetchActivity).not.toHaveBeenCalled();

        rerender(<ActivityPanel fetchActivity={fetchActivity} active={true} />);

        await waitFor(() => {
            expect(fetchActivity).toHaveBeenCalledTimes(1);
        });
        expect(await screen.findByText('Test')).toBeInTheDocument();
    });
});

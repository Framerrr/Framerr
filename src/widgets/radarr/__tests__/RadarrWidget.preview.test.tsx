/**
 * RadarrWidget — Preview Characterization (BL-W0-4)
 *
 * TASK-20260722-001 / REMEDIATION-2026-P7 / S-T-LINT-04
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../test/providers';
import RadarrWidget from '../RadarrWidget';
import type { WidgetData } from '../../types';

vi.mock('../../../context/useAuth', () => ({
    useAuth: () => ({ user: { role: 'admin' } }),
}));
vi.mock('../../../utils/permissions', () => ({ isAdmin: () => true }));
vi.mock('../../../shared/widgets/hooks/useWidgetIntegration', () => ({
    useWidgetIntegration: () => ({
        effectiveIntegrationId: null,
        effectiveDisplayName: '',
        status: 'notConfigured',
        loading: false,
    }),
}));
vi.mock('../../../shared/widgets/hooks', () => ({
    useRetryPoll: () => vi.fn(),
}));
vi.mock('../hooks/useRadarrData', () => ({
    useRadarrData: () => ({
        upcoming: [],
        calendarLoading: false,
        calendarConnected: false,
        error: null,
    }),
}));

function makeWidget(overrides?: Partial<WidgetData>): WidgetData {
    return { id: 'rdr-1', type: 'radarr', x: 0, y: 0, w: 4, h: 4, config: {}, ...overrides };
}

describe('BL-W0-4: RadarrWidget preview mode', () => {
    it('renders PreviewMode content without throwing', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { container } = render(
            <RadarrWidget widget={makeWidget()} isEditMode={false} previewMode={true} />,
            { wrapper: AllProviders },
        );
        expect(screen.getByText('Dune: Part Three')).toBeInTheDocument();
        expect(screen.getByText('Upcoming')).toBeInTheDocument();
        expect(container.querySelector('.rdr-header-chips')).toBeTruthy();
        expect(container.querySelector('.rdr-stats-bar')).toBeNull();
        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });
});

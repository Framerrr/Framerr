/**
 * SonarrWidget — Preview Characterization (BL-W0-5)
 *
 * TASK-20260722-001 / REMEDIATION-2026-P7 / S-T-LINT-04
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../test/providers';
import SonarrWidget from '../SonarrWidget';
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
vi.mock('../hooks/useSonarrData', () => ({
    useSonarrData: () => ({
        upcoming: [],
        calendarLoading: false,
        calendarConnected: false,
        error: null,
    }),
}));

function makeWidget(overrides?: Partial<WidgetData>): WidgetData {
    return { id: 'snr-1', type: 'sonarr', x: 0, y: 0, w: 4, h: 4, config: {}, ...overrides };
}

describe('BL-W0-5: SonarrWidget preview mode', () => {
    it('renders PreviewMode content without throwing', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <SonarrWidget widget={makeWidget()} isEditMode={false} previewMode={true} />,
            { wrapper: AllProviders },
        );
        expect(screen.getByText('The Last of Us')).toBeInTheDocument();
        expect(screen.getByText(/5 upcoming/)).toBeInTheDocument();
        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });
});

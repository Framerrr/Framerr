/**
 * LidarrWidget — Preview Characterization
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../test/providers';
import LidarrWidget from '../LidarrWidget';
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
vi.mock('../hooks/useLidarrData', () => ({
    useLidarrData: () => ({
        upcoming: [],
        calendarLoading: false,
        calendarConnected: false,
        error: null,
    }),
}));

function makeWidget(overrides?: Partial<WidgetData>): WidgetData {
    return { id: 'ldr-1', type: 'lidarr', x: 0, y: 0, w: 4, h: 4, config: {}, ...overrides };
}

describe('LidarrWidget preview mode', () => {
    it('renders PreviewMode content without throwing', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <LidarrWidget widget={makeWidget()} isEditMode={false} previewMode={true} />,
            { wrapper: AllProviders },
        );
        expect(screen.getByText('The Tortured Poets Department')).toBeInTheDocument();
        expect(screen.getByText(/5 upcoming/)).toBeInTheDocument();
        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });
});

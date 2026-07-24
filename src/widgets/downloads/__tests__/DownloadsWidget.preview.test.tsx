/**
 * DownloadsWidget — Preview Characterization (BL-W0-2)
 *
 * TASK-20260722-001 / REMEDIATION-2026-P7 / S-T-LINT-04
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../test/providers';
import DownloadsWidget from '../DownloadsWidget';
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
        availableIntegrations: [],
    }),
}));
vi.mock('../../../shared/widgets/hooks/useIntegrationSSE', () => ({
    useIntegrationSSE: () => ({ loading: false, isConnected: false }),
}));
vi.mock('../../../shared/widgets/hooks', () => ({
    useRetryPoll: () => vi.fn(),
}));

function makeWidget(overrides?: Partial<WidgetData>): WidgetData {
    return { id: 'dl-1', type: 'downloads', x: 0, y: 0, w: 4, h: 4, config: {}, ...overrides };
}

describe('BL-W0-2: DownloadsWidget preview mode', () => {
    it('renders PreviewWidget content without throwing', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { container } = render(
            <DownloadsWidget widget={makeWidget()} isEditMode={false} previewMode={true} />,
            { wrapper: AllProviders },
        );
        expect(screen.getByText('Ubuntu.24.04.LTS.iso')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(container.querySelector('.qbt-speed-down')).toBeTruthy();
        expect(container.querySelector('.qbt-speed-up')).toBeTruthy();
        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });
});

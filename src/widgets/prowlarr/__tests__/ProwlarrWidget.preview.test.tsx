/**
 * ProwlarrWidget — Preview Characterization (BL-W0-3)
 *
 * TASK-20260722-001 / REMEDIATION-2026-P7 / S-T-LINT-04
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../test/providers';
import ProwlarrWidget from '../ProwlarrWidget';
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
vi.mock('../hooks/useProwlarrData', () => ({
    useProwlarrData: () => ({
        healthMessages: [],
        indexers: [],
        summary: null,
        applications: [],
        loading: false,
        error: null,
    }),
}));

function makeWidget(overrides?: Partial<WidgetData>): WidgetData {
    return { id: 'prwl-1', type: 'prowlarr', x: 0, y: 0, w: 4, h: 4, config: {}, ...overrides };
}

describe('BL-W0-3: ProwlarrWidget preview mode', () => {
    it('renders PreviewMode content without throwing', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <ProwlarrWidget widget={makeWidget()} isEditMode={false} previewMode={true} />,
            { wrapper: AllProviders },
        );
        expect(screen.getByText('Indexer-1')).toBeInTheDocument();
        expect(screen.getByText('Indexer-3')).toBeInTheDocument();
        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });
});

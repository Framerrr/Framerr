/**
 * TautulliWidget — Preview Characterization (TASK-20260723-004 / T3)
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../test/providers';
import TautulliWidget from '../TautulliWidget';
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
vi.mock('../../../shared/widgets/hooks/useIntegrationSSE', () => ({
    useIntegrationSSE: () => ({ loading: false, isConnected: false }),
}));
vi.mock('../../../shared/widgets/hooks', () => ({
    useRetryPoll: () => vi.fn(),
}));
vi.mock('../hooks/useTautulliStats', () => ({
    useTautulliStats: () => ({ stats: [], statsLoading: false, statsError: null }),
}));

function makeWidget(overrides?: Partial<WidgetData>): WidgetData {
    return { id: 'taut-1', type: 'tautulli', x: 0, y: 0, w: 4, h: 4, config: {}, ...overrides };
}

describe('T3: TautulliWidget preview mode', () => {
    it('renders fixture preview with shared tab chrome without SSE hooks', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { container } = render(
            <TautulliWidget widget={makeWidget()} isEditMode={false} previewMode={true} />,
            { wrapper: AllProviders },
        );
        expect(container.querySelector('.tautulli-content')).toBeTruthy();
        expect(container.querySelector('[role="tablist"]')).toBeTruthy();
        expect(container.querySelector('.tautulli-tab-body[role="tabpanel"]')).toBeTruthy();
        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });
});

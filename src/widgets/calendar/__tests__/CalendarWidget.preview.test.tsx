/**
 * CalendarWidget — Preview Characterization (BL-W0-1)
 *
 * TASK-20260722-001 / REMEDIATION-2026-P7 / S-T-LINT-04
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../test/providers';
import CalendarWidget from '../CalendarWidget';
import type { WidgetData } from '../../types';

vi.mock('../../../context/useAuth', () => ({
    useAuth: () => ({ user: { role: 'admin' } }),
}));
vi.mock('../../../utils/permissions', () => ({ isAdmin: () => true }));
vi.mock('../../../api/hooks/useIntegrations', () => ({
    useRoleAwareIntegrations: () => ({ data: [] }),
}));
vi.mock('../../../shared/widgets/hooks/useMultiWidgetIntegration', () => ({
    useMultiWidgetIntegration: () => ({
        integrations: { sonarr: { isAccessible: false }, radarr: { isAccessible: false } },
        status: 'notConfigured',
        loading: false,
    }),
}));
vi.mock('../../../shared/widgets/hooks/useMultiIntegrationSSE', () => ({
    useMultiIntegrationSSE: () => ({
        loading: false,
        isConnected: false,
        erroredInstances: [],
        allErrored: false,
    }),
}));
vi.mock('@/features/realtime/useRealtimeSSE', () => ({
    default: () => ({ connectionId: null }),
}));
vi.mock('../../../context/useDashboardEdit', () => ({
    useDashboardEdit: () => ({ editMode: false }),
}));

function makeWidget(overrides?: Partial<WidgetData>): WidgetData {
    return { id: 'cal-1', type: 'calendar', x: 0, y: 0, w: 4, h: 4, config: {}, ...overrides };
}

describe('BL-W0-1: CalendarWidget preview mode', () => {
    it('renders PreviewMode content without throwing', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <CalendarWidget widget={makeWidget()} isEditMode={false} previewMode={true} />,
            { wrapper: AllProviders },
        );
        expect(screen.getByText('January 2025')).toBeInTheDocument();
        expect(screen.getByText('The Bear')).toBeInTheDocument();
        expect(screen.getByText('Dune 2')).toBeInTheDocument();
        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });
});

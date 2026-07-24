/**
 * DnsStatsWidget — Preview Characterization (BL-W0T-1)
 *
 * TASK-20260722-002 / REMEDIATION-2026-P7 / S-T-LINT-04b
 *
 * Preview must render static content and must not trigger live integration
 * side effects (fallback persistence, SSE subscription, retry poll binding).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../test/providers';
import DnsStatsWidget from '../DnsStatsWidget';
import type { WidgetData } from '../../types';
import type { UseIntegrationSSEOptions } from '../../../shared/widgets/hooks/useIntegrationSSE';

// ---------------------------------------------------------------------------
// Side-effect boundary spies / mocks
// ---------------------------------------------------------------------------

const mockUpdateWidgetConfig = vi.fn();
const mockUseIntegrationSSE = vi.fn((opts: UseIntegrationSSEOptions<unknown>) => {
    void opts.integrationType;
    return {
        loading: false,
        connectionId: null,
        isSubscribed: false,
        isConnected: false,
        isUnavailable: false,
        isConfigError: false,
        isAuthError: false,
    };
});
const mockApiPost = vi.fn();

vi.mock('../../../context/useAuth', () => ({
    useAuth: () => ({ user: { role: 'admin' } }),
}));
vi.mock('../../../utils/permissions', () => ({ isAdmin: () => true }));
vi.mock('../../../api/hooks/useWidgetQueries', () => ({
    useMyWidgetAccess: () => ({ data: { widgets: 'all' }, isLoading: false }),
}));
vi.mock('../../../shared/widgets/hooks/useIntegrationFallback', () => ({
    useIntegrationFallback: () => ({
        integrationId: 'dns-123',
        isFallback: false,
        reason: 'configured',
        fallbackInstance: undefined,
        compatibleInstances: [{ id: 'dns-123', displayName: 'AdGuard', type: 'adguard' }],
        loading: false,
    }),
}));
vi.mock('../../../api/endpoints', () => ({
    widgetsApi: {
        updateWidgetConfig: (...args: unknown[]) => mockUpdateWidgetConfig(...args),
    },
}));
vi.mock('../../../context/notification', () => ({
    useToasts: () => ({
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        showToast: vi.fn(),
        toasts: [],
        dismissToast: vi.fn(),
    }),
}));
vi.mock('../../../shared/widgets', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../shared/widgets')>();
    return {
        ...actual,
        useIntegrationSSE: (opts: UseIntegrationSSEOptions<unknown>) => mockUseIntegrationSSE(opts),
    };
});
vi.mock('@/features/realtime/useRealtimeSSE', () => ({
    default: () => ({
        connectionId: 'preview-test-connection',
        subscribeToTopic: vi.fn().mockResolvedValue(vi.fn()),
        isConnected: false,
    }),
}));
vi.mock('../../../api/client', () => ({
    default: {
        post: (...args: unknown[]) => mockApiPost(...args),
        get: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));
vi.mock('../../../utils/logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

function makeWidget(overrides?: Partial<WidgetData>): WidgetData {
    return {
        id: 'dns-stats-1',
        type: 'dns-stats',
        x: 0,
        y: 0,
        w: 4,
        h: 4,
        config: { integrationId: 'dns-123' },
        ...overrides,
    };
}

describe('BL-W0T-1: DnsStatsWidget preview mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders PreviewMode content without live integration side effects', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <DnsStatsWidget widget={makeWidget()} isEditMode={false} previewMode={true} />,
            { wrapper: AllProviders },
        );

        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('ads.example.com')).toBeInTheDocument();

        await vi.advanceTimersByTimeAsync(1000);

        expect(mockUpdateWidgetConfig).not.toHaveBeenCalled();

        // Early exit: preview path must not invoke integration/SSE hooks at all
        expect(mockUseIntegrationSSE).not.toHaveBeenCalled();

        const retryCalls = mockApiPost.mock.calls.filter(
            ([url]) => url === '/api/realtime/retry',
        );
        expect(retryCalls).toHaveLength(0);

        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });
});

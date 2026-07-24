/**
 * useActiveWidgets — Behavior Lock Characterization Tests
 *
 * TASK-20260722-004 / REMEDIATION-2026-P7 / S-T-LINT-04d (BL-04d-AW)
 *
 * Locks mutation payload shapes and dispatchCustomEvent behavior for all four
 * mutation callbacks on desktop and mobile-independent paths before useMemo wraps.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { WidgetsResponse } from '../../../api/endpoints/widgets';
import type { Widget } from '../types';
import { CustomEventNames } from '../../../types/events';

// ============================================================================
// MOCKS — before hook import
// ============================================================================

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue({});
const mockRefetchWidgets = vi.fn();
const mockDispatchCustomEvent = vi.fn();

let mockWidgetsData: WidgetsResponse | undefined;
let mockIsMobile = false;

vi.mock('../../../context/useLayout', () => ({
    useLayout: () => ({ isMobile: mockIsMobile }),
}));

vi.mock('../../../context/notification', () => ({
    useNotifications: () => ({
        error: mockShowError,
        success: mockShowSuccess,
    }),
}));

vi.mock('../../../api/hooks/useDashboard', () => ({
    useWidgets: () => ({
        data: mockWidgetsData,
        isLoading: false,
        refetch: mockRefetchWidgets,
    }),
    useSaveWidgets: () => ({
        mutateAsync: mockMutateAsync,
    }),
}));

vi.mock('../../../api/hooks', () => ({
    useRoleAwareIntegrations: () => ({ data: [] }),
    useIntegrationSchemas: () => ({ data: undefined }),
}));

vi.mock('../../../widgets/registry', () => ({
    getWidgetIconName: (type: string) => `default-icon-${type}`,
}));

vi.mock('../../../utils/logger', () => ({
    default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../types/events', () => ({
    dispatchCustomEvent: (...args: unknown[]) => mockDispatchCustomEvent(...args),
    CustomEventNames: {
        WIDGETS_ADDED: 'widgets-added',
        WIDGET_CONFIG_CHANGED: 'widget-config-changed',
        WIDGETS_UPDATED: 'widgets-updated',
    },
}));

import { useActiveWidgets } from './useActiveWidgets';

// ============================================================================
// FIXTURES
// ============================================================================

function makeWidget(id: string, overrides: Partial<Widget> = {}): Widget {
    return {
        id,
        type: 'clock',
        layout: { x: 0, y: 0, w: 2, h: 2 },
        mobileLayout: { x: 0, y: 0, w: 2, h: 1 },
        config: { title: id },
        ...overrides,
    };
}

function makeWidgetsData(
    mode: 'linked' | 'independent' = 'linked',
    widgets?: Widget[],
    mobileWidgets?: Widget[],
): WidgetsResponse {
    return {
        widgets: widgets ?? [makeWidget('w1'), makeWidget('w2')],
        mobileWidgets: mobileWidgets ?? [makeWidget('m1'), makeWidget('m2')],
        mobileLayoutMode: mode,
    };
}

async function setViewModeDesktop(result: { current: ReturnType<typeof useActiveWidgets> }) {
    await act(async () => {
        result.current.setViewMode('desktop');
    });
}

async function setViewModeMobileIndependent(result: { current: ReturnType<typeof useActiveWidgets> }) {
    await act(async () => {
        result.current.setViewMode('mobile');
    });
}

// ============================================================================
// TESTS
// ============================================================================

describe('useActiveWidgets characterization (BL-04d-AW)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsMobile = false;
        mockWidgetsData = makeWidgetsData('independent');
    });

    describe('handleRemove', () => {
        it('desktop path — filters widgets and dispatches WIDGETS_ADDED', async () => {
            mockWidgetsData = makeWidgetsData('linked');
            const { result } = renderHook(() => useActiveWidgets());
            await setViewModeDesktop(result);

            await act(async () => {
                await result.current.handleRemove('w1');
            });

            expect(mockMutateAsync).toHaveBeenCalledWith({
                widgets: [makeWidget('w2')],
                mobileLayoutMode: 'linked',
                mobileWidgets: undefined,
            });
            expect(mockDispatchCustomEvent).toHaveBeenCalledWith(CustomEventNames.WIDGETS_ADDED);
            expect(mockShowSuccess).toHaveBeenCalledWith('Widget Removed', 'Widget removed from dashboard');
        });

        it('mobile-independent path — filters mobileWidgets', async () => {
            const widgets = [makeWidget('w1'), makeWidget('w2')];
            const mobileWidgets = [makeWidget('m1'), makeWidget('m2')];
            mockWidgetsData = makeWidgetsData('independent', widgets, mobileWidgets);
            const { result } = renderHook(() => useActiveWidgets());
            await setViewModeMobileIndependent(result);

            await act(async () => {
                await result.current.handleRemove('m1');
            });

            expect(mockMutateAsync).toHaveBeenCalledWith({
                widgets,
                mobileLayoutMode: 'independent',
                mobileWidgets: [makeWidget('m2')],
            });
            expect(mockDispatchCustomEvent).toHaveBeenCalledWith(CustomEventNames.WIDGETS_ADDED);
        });
    });

    describe('handleIconSelect', () => {
        it('desktop path — custom icon + WIDGET_CONFIG_CHANGED target desktop', async () => {
            mockWidgetsData = makeWidgetsData('linked');
            const { result } = renderHook(() => useActiveWidgets());
            await setViewModeDesktop(result);

            await act(async () => {
                await result.current.handleIconSelect('w1', 'custom-star');
            });

            expect(mockMutateAsync).toHaveBeenCalledWith({
                widgets: [
                    makeWidget('w1', { config: { title: 'w1', customIcon: 'custom-star', iconOverridden: true } }),
                    makeWidget('w2'),
                ],
                mobileLayoutMode: 'linked',
                mobileWidgets: undefined,
            });
            expect(mockDispatchCustomEvent).toHaveBeenCalledWith(
                CustomEventNames.WIDGET_CONFIG_CHANGED,
                expect.objectContaining({
                    widgetId: 'w1',
                    target: 'desktop',
                    config: expect.objectContaining({ customIcon: 'custom-star', iconOverridden: true }),
                }),
            );
        });

        it('desktop path — default icon clears overrides', async () => {
            const widgets = [
                makeWidget('w1', { config: { title: 'w1', customIcon: 'x', iconOverridden: true } }),
                makeWidget('w2'),
            ];
            mockWidgetsData = makeWidgetsData('linked', widgets);
            const { result } = renderHook(() => useActiveWidgets());
            await setViewModeDesktop(result);

            await act(async () => {
                await result.current.handleIconSelect('w1', 'default-icon-clock');
            });

            expect(mockMutateAsync).toHaveBeenCalledWith({
                widgets: [
                    makeWidget('w1', { config: { title: 'w1', customIcon: undefined, iconOverridden: false } }),
                    makeWidget('w2'),
                ],
                mobileLayoutMode: 'linked',
                mobileWidgets: undefined,
            });
        });

        it('mobile-independent path — WIDGET_CONFIG_CHANGED target mobile', async () => {
            const widgets = [makeWidget('w1')];
            const mobileWidgets = [makeWidget('m1')];
            mockWidgetsData = makeWidgetsData('independent', widgets, mobileWidgets);
            const { result } = renderHook(() => useActiveWidgets());
            await setViewModeMobileIndependent(result);

            await act(async () => {
                await result.current.handleIconSelect('m1', 'mobile-icon');
            });

            expect(mockMutateAsync).toHaveBeenCalledWith({
                widgets,
                mobileLayoutMode: 'independent',
                mobileWidgets: [
                    makeWidget('m1', { config: { title: 'm1', customIcon: 'mobile-icon', iconOverridden: true } }),
                ],
            });
            expect(mockDispatchCustomEvent).toHaveBeenCalledWith(
                CustomEventNames.WIDGET_CONFIG_CHANGED,
                expect.objectContaining({ widgetId: 'm1', target: 'mobile' }),
            );
        });
    });

    describe('updateWidgetConfig', () => {
        it('desktop path — merges config and dispatches desktop target', async () => {
            mockWidgetsData = makeWidgetsData('linked');
            const { result } = renderHook(() => useActiveWidgets());
            await setViewModeDesktop(result);

            await act(async () => {
                await result.current.updateWidgetConfig('w1', { title: 'Updated Title' });
            });

            expect(mockMutateAsync).toHaveBeenCalledWith({
                widgets: [
                    makeWidget('w1', { config: { title: 'Updated Title' } }),
                    makeWidget('w2'),
                ],
                mobileLayoutMode: 'linked',
                mobileWidgets: undefined,
            });
            expect(mockDispatchCustomEvent).toHaveBeenCalledWith(
                CustomEventNames.WIDGET_CONFIG_CHANGED,
                expect.objectContaining({ widgetId: 'w1', target: 'desktop' }),
            );
        });

        it('mobile-independent path — merges mobileWidgets config', async () => {
            const widgets = [makeWidget('w1')];
            const mobileWidgets = [makeWidget('m1')];
            mockWidgetsData = makeWidgetsData('independent', widgets, mobileWidgets);
            const { result } = renderHook(() => useActiveWidgets());
            await setViewModeMobileIndependent(result);

            await act(async () => {
                await result.current.updateWidgetConfig('m1', { title: 'Mobile Title' });
            });

            expect(mockMutateAsync).toHaveBeenCalledWith({
                widgets,
                mobileLayoutMode: 'independent',
                mobileWidgets: [makeWidget('m1', { config: { title: 'Mobile Title' } })],
            });
            expect(mockDispatchCustomEvent).toHaveBeenCalledWith(
                CustomEventNames.WIDGET_CONFIG_CHANGED,
                expect.objectContaining({ widgetId: 'm1', target: 'mobile' }),
            );
        });
    });

    describe('resizeWidget', () => {
        it('desktop path — updates layout and dispatches WIDGETS_UPDATED (no target)', async () => {
            mockWidgetsData = makeWidgetsData('linked');
            const { result } = renderHook(() => useActiveWidgets());
            await setViewModeDesktop(result);

            await act(async () => {
                await result.current.resizeWidget('w1', { w: 4, h: 3 });
            });

            expect(mockMutateAsync).toHaveBeenCalledWith({
                widgets: [
                    makeWidget('w1', { layout: { x: 0, y: 0, w: 4, h: 3 } }),
                    makeWidget('w2'),
                ],
                mobileLayoutMode: 'linked',
                mobileWidgets: undefined,
            });
            expect(mockDispatchCustomEvent).toHaveBeenCalledWith(CustomEventNames.WIDGETS_UPDATED);
            expect(mockDispatchCustomEvent).not.toHaveBeenCalledWith(
                CustomEventNames.WIDGET_CONFIG_CHANGED,
                expect.anything(),
            );
        });

        it('mobile-independent path — updates mobileLayout with layout fallback', async () => {
            const widgets = [makeWidget('w1')];
            const mobileWidgets = [makeWidget('m1', { mobileLayout: undefined })];
            mockWidgetsData = makeWidgetsData('independent', widgets, mobileWidgets);
            const { result } = renderHook(() => useActiveWidgets());
            await setViewModeMobileIndependent(result);

            await act(async () => {
                await result.current.resizeWidget('m1', { h: 2 });
            });

            expect(mockMutateAsync).toHaveBeenCalledWith({
                widgets,
                mobileLayoutMode: 'independent',
                mobileWidgets: [
                    makeWidget('m1', {
                        mobileLayout: { x: 0, y: 0, w: 2, h: 2 },
                    }),
                ],
            });
            expect(mockDispatchCustomEvent).toHaveBeenCalledWith(CustomEventNames.WIDGETS_UPDATED);
        });
    });

    describe('reference stability', () => {
        it('keeps widgets/mobileWidgets references when widgetsData is unchanged', async () => {
            mockWidgetsData = makeWidgetsData('independent');
            const { result, rerender } = renderHook(() => useActiveWidgets());

            await waitFor(() => {
                expect(result.current.widgets).toHaveLength(2);
            });

            const widgetsRef = result.current.widgets;
            const mobileWidgetsRef = result.current.mobileWidgets;

            rerender();

            expect(result.current.widgets).toBe(widgetsRef);
            expect(result.current.mobileWidgets).toBe(mobileWidgetsRef);
        });

        it('changes widgets reference when widgetsData changes', async () => {
            mockWidgetsData = makeWidgetsData('linked');
            const { result, rerender } = renderHook(() => useActiveWidgets());

            await waitFor(() => {
                expect(result.current.widgets).toHaveLength(2);
            });

            const widgetsRef = result.current.widgets;
            mockWidgetsData = makeWidgetsData('linked', [makeWidget('w3')]);
            rerender();

            expect(result.current.widgets).not.toBe(widgetsRef);
            expect(result.current.widgets).toHaveLength(1);
        });
    });
});

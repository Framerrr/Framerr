/**
 * MetricLayoutEditor — Behavior Lock Characterization Tests
 *
 * TASK-20260722-004 / REMEDIATION-2026-P7 / S-T-LINT-04d (BL-04d-MLE)
 *
 * Locks updateConfig payloads and rerender stability before diskList/metricViz useMemo wraps.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import MetricLayoutEditor from '../components/MetricLayoutEditor';

vi.mock('../../../api/hooks', () => ({
    useIntegrationSchemas: () => ({ data: undefined }),
}));

function makeGaugeConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        integrationId: 'glances-test123',
        showCpu: true,
        showMemory: true,
        showTemperature: false,
        showUptime: false,
        showDiskUsage: false,
        showNetworkUp: false,
        showNetworkDown: false,
        metricOrder: ['cpu', 'memory'],
        metricSpans: { cpu: 2, memory: 2 },
        metricViz: {},
        ...overrides,
    };
}

function makeDiskRemovalConfig(): Record<string, unknown> {
    return {
        integrationId: 'glances-test123',
        showCpu: false,
        showMemory: false,
        showTemperature: false,
        showUptime: false,
        showDiskUsage: true,
        showNetworkUp: false,
        showNetworkDown: false,
        diskCollapsed: 'individual',
        _diskList: [
            { id: 'disk-a', name: 'Disk A' },
            { id: 'disk-b', name: 'Disk B' },
        ],
        diskSelection: ['disk-a', 'disk-b'],
        diskMetricOrder: ['disk-disk-a', 'disk-disk-b'],
        diskMetricSpans: { 'disk-disk-a': 2, 'disk-disk-b': 2 },
        metricViz: {},
    };
}

describe('MetricLayoutEditor characterization (BL-04d-MLE)', () => {
    let updateConfig: (key: string, value: unknown) => void;

    beforeEach(() => {
        updateConfig = vi.fn();
    });

    it('(a) toggling a slot to gauge calls updateConfig with merged metricViz', () => {
        const config = makeGaugeConfig();
        render(
            <MetricLayoutEditor config={config} updateConfig={updateConfig} widgetHeight={6} />,
        );

        const cpuRowGauge = screen.getAllByTitle('Gauge')[0];
        fireEvent.click(cpuRowGauge);

        expect(updateConfig).toHaveBeenCalledWith('metricViz', { cpu: 'gauge' });
    });

    it('(b) removing a disk metric calls updateConfig with updated diskSelection ids', () => {
        const config = makeDiskRemovalConfig();
        render(
            <MetricLayoutEditor config={config} updateConfig={updateConfig} widgetHeight={6} />,
        );

        const removeButtons = screen.getAllByTitle(/Hide Disk A/i);
        fireEvent.click(removeButtons[0]);

        expect(updateConfig).toHaveBeenCalledWith('diskSelection', ['disk-b']);
    });

    it('(c) rerender with same config reference does not trigger extra updateConfig or markup drift', () => {
        const config = makeGaugeConfig();
        const { container, rerender } = render(
            <MetricLayoutEditor config={config} updateConfig={updateConfig} widgetHeight={6} />,
        );

        const initialCallCount = (updateConfig as ReturnType<typeof vi.fn>).mock.calls.length;
        const slots = container.querySelectorAll('.metric-slot');
        const initialSlotCount = slots.length;
        const initialMarkup = Array.from(slots).map((el) => el.outerHTML).join('');

        rerender(
            <MetricLayoutEditor config={config} updateConfig={updateConfig} widgetHeight={6} />,
        );

        expect((updateConfig as ReturnType<typeof vi.fn>).mock.calls.length).toBe(initialCallCount);
        const rerenderSlots = container.querySelectorAll('.metric-slot');
        expect(rerenderSlots.length).toBe(initialSlotCount);
        const rerenderMarkup = Array.from(rerenderSlots).map((el) => el.outerHTML).join('');
        expect(rerenderMarkup).toBe(initialMarkup);
    });
});

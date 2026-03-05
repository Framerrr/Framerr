/**
 * useMetricConfig — Behavior Lock Characterization Tests
 *
 * TASK-20260301-007 / REMEDIATION-2026 / S-H3-02
 *
 * These tests lock the current behavior of useMetricConfig before converting
 * the render-time ref mutation to useEffect + useState:
 *   BL-1  — Sticky "ever seen" metric visibility (null → non-null → null round-trip)
 *   BL-3  — Row packing + CSS var output via hook output
 *   BL-4  — Config round-trip (saved config inputs produce correct visible metrics)
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMetricConfig, METRIC_REGISTRY } from '../hooks/useMetricConfig';
import type { StatusData } from '../types';

// ============================================================================
// HELPERS
// ============================================================================

/** Build a minimal StatusData with defaults */
function makeStatusData(overrides?: Partial<StatusData>): StatusData {
    return {
        cpu: 50,
        memory: 40,
        temperature: 45,
        uptime: '1d 2h',
        diskUsage: null,
        arrayStatus: null,
        networkUp: null,
        networkDown: null,
        disks: [],
        ...overrides,
    };
}

/** Default hook options for a simple 4-unit-tall widget */
function makeHookOptions(overrides?: Record<string, unknown>) {
    return {
        widgetId: 'test-widget-1',
        config: {} as Record<string, unknown>,
        widgetH: 4,
        showHeader: true,
        integrationType: 'glances',
        statusData: undefined as StatusData | undefined,
        ...overrides,
    };
}

// ============================================================================
// BL-1: Sticky "ever seen" metric visibility
// ============================================================================

describe('BL-1: Sticky "ever seen" metric visibility', () => {
    it('hides metrics that have never reported non-null data', () => {
        const statusData = makeStatusData({
            cpu: 50,
            memory: 40,
            temperature: 45,
            uptime: '1d',
            networkUp: null,
            networkDown: null,
        });

        const { result } = renderHook(() =>
            useMetricConfig(makeHookOptions({ statusData }))
        );

        const visibleKeys = result.current.visibleMetrics.map(m => m.key);
        // networkUp and networkDown should NOT be visible (null, never seen)
        expect(visibleKeys).not.toContain('networkUp');
        expect(visibleKeys).not.toContain('networkDown');
        // CPU, memory, temp, uptime should be visible
        expect(visibleKeys).toContain('cpu');
        expect(visibleKeys).toContain('memory');
        expect(visibleKeys).toContain('temperature');
        expect(visibleKeys).toContain('uptime');
    });

    it('shows metrics once they report non-null data', () => {
        const initialData = makeStatusData({ networkUp: null, networkDown: null });

        const { result, rerender } = renderHook(
            ({ statusData }) => useMetricConfig(makeHookOptions({ statusData })),
            { initialProps: { statusData: initialData } }
        );

        // Initially networkUp should be hidden
        let visibleKeys = result.current.visibleMetrics.map(m => m.key);
        expect(visibleKeys).not.toContain('networkUp');

        // Now networkUp reports a value
        const updatedData = makeStatusData({ networkUp: 1500, networkDown: null });
        rerender({ statusData: updatedData });

        visibleKeys = result.current.visibleMetrics.map(m => m.key);
        expect(visibleKeys).toContain('networkUp');
    });

    it('keeps metric visible even after it goes back to null (sticky)', () => {
        const phase1 = makeStatusData({ networkUp: null });
        const phase2 = makeStatusData({ networkUp: 1500 });
        const phase3 = makeStatusData({ networkUp: null });

        const { result, rerender } = renderHook(
            ({ statusData }) => useMetricConfig(makeHookOptions({ statusData })),
            { initialProps: { statusData: phase1 } }
        );

        // Phase 1: networkUp null → hidden
        let visibleKeys = result.current.visibleMetrics.map(m => m.key);
        expect(visibleKeys).not.toContain('networkUp');

        // Phase 2: networkUp non-null → visible
        rerender({ statusData: phase2 });
        visibleKeys = result.current.visibleMetrics.map(m => m.key);
        expect(visibleKeys).toContain('networkUp');

        // Phase 3: networkUp null again → STILL visible (sticky)
        rerender({ statusData: phase3 });
        visibleKeys = result.current.visibleMetrics.map(m => m.key);
        expect(visibleKeys).toContain('networkUp');
    });
});

// ============================================================================
// BL-3: Row packing + CSS var output
// ============================================================================

describe('BL-3: Row packing and CSS var output', () => {
    it('packs 4 metrics (span=2 each) into 2 rows at widgetH=4', () => {
        // Show only CPU, Memory, Temperature, Uptime (all default span=2)
        // Hide disk, networkUp, networkDown
        const config: Record<string, unknown> = {
            showCpu: true,
            showMemory: true,
            showTemperature: true,
            showUptime: true,
            showDiskUsage: false,
            showNetworkUp: false,
            showNetworkDown: false,
        };

        const statusData = makeStatusData({
            cpu: 50,
            memory: 40,
            temperature: 45,
            uptime: '1d',
        });

        const { result } = renderHook(() =>
            useMetricConfig(makeHookOptions({
                config,
                statusData,
                widgetH: 4,
                showHeader: true,
            }))
        );

        // Should have exactly 2 rows
        expect(result.current.rowGroups).toHaveLength(2);

        // Row 0: CPU (span=2) + Memory (span=2) = 4 columns
        expect(result.current.rowGroups[0]).toHaveLength(2);
        expect(result.current.rowGroups[0][0].key).toBe('cpu');
        expect(result.current.rowGroups[0][1].key).toBe('memory');
        expect(result.current.rowGroups[0][0].effectiveSpan).toBe(2);
        expect(result.current.rowGroups[0][1].effectiveSpan).toBe(2);

        // Row 1: Temperature (span=2) + Uptime (span=2) = 4 columns
        expect(result.current.rowGroups[1]).toHaveLength(2);
        expect(result.current.rowGroups[1][0].key).toBe('temperature');
        expect(result.current.rowGroups[1][1].key).toBe('uptime');
        expect(result.current.rowGroups[1][0].effectiveSpan).toBe(2);
        expect(result.current.rowGroups[1][1].effectiveSpan).toBe(2);
    });

    it('produces CSS vars with --ss-pad, --ss-gap, and per-row height vars', () => {
        const config: Record<string, unknown> = {
            showCpu: true,
            showMemory: true,
            showTemperature: true,
            showUptime: true,
            showDiskUsage: false,
            showNetworkUp: false,
            showNetworkDown: false,
        };

        const statusData = makeStatusData({
            cpu: 50,
            memory: 40,
            temperature: 45,
            uptime: '1d',
        });

        const { result } = renderHook(() =>
            useMetricConfig(makeHookOptions({
                config,
                statusData,
                widgetH: 4,
                showHeader: true,
            }))
        );

        const vars = result.current.gridCssVars;

        // Must contain --ss-pad and --ss-gap
        expect(vars).toHaveProperty('--ss-pad');
        expect(vars).toHaveProperty('--ss-gap');

        // Must contain per-row height vars (2 rows → --ss-row-0 and --ss-row-1)
        expect(vars).toHaveProperty('--ss-row-0');
        expect(vars).toHaveProperty('--ss-row-1');

        // Values should be pixel strings
        expect(vars['--ss-pad']).toMatch(/^\d+px$/);
        expect(vars['--ss-gap']).toMatch(/^\d+px$/);
        expect(vars['--ss-row-0']).toMatch(/^\d+px$/);
        expect(vars['--ss-row-1']).toMatch(/^\d+px$/);
    });

    it('auto-stretches last metric in a row to fill 4 columns', () => {
        // 3 metrics: CPU(span=2) + Memory(span=1) → row fills to 4 (Memory stretches to 3)
        // Temperature(span=2) → solo row, stretches to 4
        const config: Record<string, unknown> = {
            showCpu: true,
            showMemory: true,
            showTemperature: true,
            showUptime: false,
            showDiskUsage: false,
            showNetworkUp: false,
            showNetworkDown: false,
            metricSpans: { cpu: 2, memory: 1, temperature: 2 },
        };

        const statusData = makeStatusData({
            cpu: 50,
            memory: 40,
            temperature: 45,
        });

        const { result } = renderHook(() =>
            useMetricConfig(makeHookOptions({
                config,
                statusData,
                widgetH: 4,
                showHeader: true,
            }))
        );

        // Row 0: CPU(span=2, eff=2) + Memory(span=1, eff=1 stretched to 2)
        expect(result.current.rowGroups[0][0].key).toBe('cpu');
        expect(result.current.rowGroups[0][0].effectiveSpan).toBe(2);
        expect(result.current.rowGroups[0][1].key).toBe('memory');
        expect(result.current.rowGroups[0][1].effectiveSpan).toBe(2); // stretched from 1 to fill

        // Row 1: Temperature(span=2, stretched to 4)
        expect(result.current.rowGroups[1][0].key).toBe('temperature');
        expect(result.current.rowGroups[1][0].effectiveSpan).toBe(4); // stretched from 2 to fill
    });
});

// ============================================================================
// BL-4: Config round-trip — saved config inputs produce correct visible metrics
// ============================================================================

describe('BL-4: Config round-trip', () => {
    it('respects custom metricOrder and metricSpans from config', () => {
        const config: Record<string, unknown> = {
            metricOrder: ['memory', 'cpu', 'uptime'],
            metricSpans: { memory: 4, cpu: 2, uptime: 2 },
            showCpu: true,
            showMemory: true,
            showUptime: true,
            showTemperature: false,
            showDiskUsage: false,
            showNetworkUp: false,
            showNetworkDown: false,
        };

        const statusData = makeStatusData({
            cpu: 50,
            memory: 40,
            temperature: 45,
            uptime: '1d',
        });

        const { result } = renderHook(() =>
            useMetricConfig(makeHookOptions({ config, statusData }))
        );

        // visibleMetrics should be in config order: memory, cpu, uptime
        const visibleKeys = result.current.visibleMetrics.map(m => m.key);
        expect(visibleKeys).toEqual(['memory', 'cpu', 'uptime']);

        // Temperature should NOT be in visibleMetrics (showTemperature: false)
        expect(visibleKeys).not.toContain('temperature');

        // packedMetrics should respect custom spans
        expect(result.current.packedMetrics[0].key).toBe('memory');
        expect(result.current.packedMetrics[0].span).toBe(4);
        expect(result.current.packedMetrics[1].key).toBe('cpu');
        expect(result.current.packedMetrics[1].span).toBe(2);
        expect(result.current.packedMetrics[2].key).toBe('uptime');
        expect(result.current.packedMetrics[2].span).toBe(2);
    });

    it('filters out disabled metrics from visibleMetrics', () => {
        const config: Record<string, unknown> = {
            showCpu: true,
            showMemory: true,
            showTemperature: false,
            showUptime: false,
            showDiskUsage: false,
            showNetworkUp: false,
            showNetworkDown: false,
        };

        const statusData = makeStatusData({
            cpu: 50,
            memory: 40,
            temperature: 45,
            uptime: '1d',
        });

        const { result } = renderHook(() =>
            useMetricConfig(makeHookOptions({ config, statusData }))
        );

        const visibleKeys = result.current.visibleMetrics.map(m => m.key);
        expect(visibleKeys).toContain('cpu');
        expect(visibleKeys).toContain('memory');
        expect(visibleKeys).not.toContain('temperature');
        expect(visibleKeys).not.toContain('uptime');
        expect(visibleKeys).not.toContain('diskUsage');
        expect(visibleKeys).not.toContain('networkUp');
        expect(visibleKeys).not.toContain('networkDown');
    });

    it('produces correct visibleCount matching visibleMetrics length', () => {
        const config: Record<string, unknown> = {
            showCpu: true,
            showMemory: true,
            showTemperature: true,
            showUptime: false,
            showDiskUsage: false,
            showNetworkUp: false,
            showNetworkDown: false,
        };

        const statusData = makeStatusData({ cpu: 50, memory: 40, temperature: 45 });

        const { result } = renderHook(() =>
            useMetricConfig(makeHookOptions({ config, statusData }))
        );

        expect(result.current.visibleCount).toBe(result.current.visibleMetrics.length);
        expect(result.current.visibleCount).toBe(3);
    });
});

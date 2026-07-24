/**
 * MetricLayoutEditor — pure-function gauge gating tests (EG-1)
 */
import { describe, it, expect } from 'vitest';
import {
    effectiveMinWidth,
    canEnableGaugeInRow,
    computeGaugeAutoAdjustRow,
    resizePairedRow,
    canAcceptSwap,
} from '../components/metricLayoutMath';

describe('Editor gauge width gating', () => {
    it('effectiveMinWidth returns 2 for gauge-configured eligible key, 1 otherwise', () => {
        expect(effectiveMinWidth('cpu', { cpu: 'gauge' })).toBe(2);
        expect(effectiveMinWidth('cpu', {})).toBe(1);
        expect(effectiveMinWidth('networkUp', { networkUp: 'gauge' })).toBe(1);
    });

    it('canEnableGaugeInRow allows wide, redistributable, and solo rows', () => {
        expect(canEnableGaugeInRow([{ key: 'cpu', w: 2 }, { key: 'memory', w: 2 }], 0, {})).toBe(true);
        expect(canEnableGaugeInRow([{ key: 'cpu', w: 1 }, { key: 'memory', w: 3 }], 0, {})).toBe(true);
        expect(canEnableGaugeInRow([{ key: 'cpu', w: 1 }, { key: 'memory', w: 3 }], 0, { memory: 'gauge' })).toBe(true);
        expect(canEnableGaugeInRow([{ key: 'cpu', w: 4 }], 0, {})).toBe(true);
    });

    it('computeGaugeAutoAdjustRow redistributes 1/3 to 2/2 or returns null when already wide', () => {
        expect(computeGaugeAutoAdjustRow([{ key: 'cpu', w: 1 }, { key: 'memory', w: 3 }], 0, {})).toEqual([
            { key: 'cpu', w: 2 },
            { key: 'memory', w: 2 },
        ]);
        expect(computeGaugeAutoAdjustRow([{ key: 'cpu', w: 2 }, { key: 'memory', w: 2 }], 0, {})).toBeNull();
    });

    it('resizePairedRow refuses gauge floor violations from either side', () => {
        expect(resizePairedRow([{ key: 'cpu', w: 2 }, { key: 'memory', w: 2 }], 0, -1, { cpu: 'gauge' })).toBeNull();
        expect(resizePairedRow([{ key: 'cpu', w: 2 }, { key: 'memory', w: 2 }], 0, -1, {})).toEqual([
            { key: 'cpu', w: 1 },
            { key: 'memory', w: 3 },
        ]);
        expect(resizePairedRow([{ key: 'cpu', w: 2 }, { key: 'memory', w: 2 }], 1, 1, { cpu: 'gauge' })).toBeNull();
    });

    it('canAcceptSwap rejects swaps that would land a gauge below its floor', () => {
        expect(canAcceptSwap({ key: 'cpu', w: 2 }, { key: 'networkUp', w: 1 }, { cpu: 'gauge' })).toBe(false);
        expect(canAcceptSwap({ key: 'cpu', w: 2 }, { key: 'memory', w: 2 }, { cpu: 'gauge' })).toBe(true);
    });
});

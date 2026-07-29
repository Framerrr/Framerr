/**
 * SystemStatusWidget — uptime shrink-to-fit (public preview surface)
 * TASK-20260726-002
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { AllProviders } from '../../../test/providers';
import SystemStatusWidget from '../SystemStatusWidget';
import type { WidgetData } from '../../types';

vi.mock('../../../context/useLayout', () => ({
    useLayout: () => ({ isMobile: false }),
}));

vi.mock('../../../api/hooks', () => ({
    useIntegrationSchemas: () => ({
        data: {
            glances: {
                metrics: [
                    { key: 'cpu', recordable: true },
                    { key: 'memory', recordable: true },
                    { key: 'temperature', recordable: true },
                    { key: 'uptime', recordable: false },
                    { key: 'diskUsage', recordable: false },
                    { key: 'networkUp', recordable: false },
                    { key: 'networkDown', recordable: false },
                ],
            },
        },
    }),
}));

class MockResizeObserver {
    static instances: MockResizeObserver[] = [];
    callback: ResizeObserverCallback;
    target: Element | null = null;
    constructor(cb: ResizeObserverCallback) {
        this.callback = cb;
        MockResizeObserver.instances.push(this);
    }
    observe(target: Element) {
        this.target = target;
    }
    unobserve() {}
    disconnect() {}
}

function makeWidget(): WidgetData {
    return {
        id: 'test-widget-1',
        type: 'system-status',
        x: 0,
        y: 0,
        w: 4,
        h: 4,
        config: {},
    };
}

describe('SystemStatusWidget uptime shrink-to-fit', () => {
    beforeEach(() => {
        MockResizeObserver.instances = [];
        vi.stubGlobal('ResizeObserver', MockResizeObserver);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('applies scale < 1 when uptime header content overflows', () => {
        render(
            <SystemStatusWidget widget={makeWidget()} isEditMode={false} previewMode={true} />,
            { wrapper: AllProviders },
        );

        const header = screen.getByText('Uptime').closest('.metric-card__header') as HTMLElement;
        expect(header).toBeTruthy();

        Object.defineProperty(header, 'clientWidth', { value: 40, configurable: true });
        Object.defineProperty(header, 'clientHeight', { value: 20, configurable: true });
        Array.from(header.children).forEach((child) => {
            Object.defineProperty(child, 'scrollWidth', { value: 200, configurable: true });
            Object.defineProperty(child, 'offsetHeight', { value: 30, configurable: true });
        });

        const instance = MockResizeObserver.instances.find((i) => i.target === header);
        expect(instance).toBeTruthy();

        act(() => {
            instance!.callback(
                [] as unknown as ResizeObserverEntry[],
                instance! as unknown as ResizeObserver,
            );
        });

        const match = /scale\(([\d.]+)\)/.exec(header.style.transform);
        expect(match).toBeTruthy();
        expect(Number(match![1])).toBeLessThan(1);
    });
});

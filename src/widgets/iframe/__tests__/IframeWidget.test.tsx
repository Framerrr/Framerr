/**
 * IframeWidget — Hide Scrollbar class wiring
 * TASK-20260726-002
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import IframeWidget from '../IframeWidget';
import type { WidgetData } from '../../types';

function makeWidget(config: Record<string, unknown>): WidgetData {
    return {
        id: 'iframe-1',
        type: 'iframe',
        x: 0,
        y: 0,
        w: 6,
        h: 6,
        config,
    };
}

describe('IframeWidget hideScrollbar', () => {
    it('does not add iframe-hide-scrollbar by default', () => {
        const { container } = render(
            <IframeWidget
                widget={makeWidget({ url: 'https://example.com' })}
                isEditMode={false}
            />,
        );
        const wrap = container.querySelector('.iframe-container');
        expect(wrap).toBeTruthy();
        expect(wrap?.classList.contains('iframe-hide-scrollbar')).toBe(false);
    });

    it('adds iframe-hide-scrollbar when hideScrollbar is true', () => {
        const { container } = render(
            <IframeWidget
                widget={makeWidget({ url: 'https://example.com', hideScrollbar: true })}
                isEditMode={false}
            />,
        );
        const wrap = container.querySelector('.iframe-container');
        expect(wrap?.classList.contains('iframe-hide-scrollbar')).toBe(true);
    });

    it('keeps hideScrollbar and allowInteraction classes independent', () => {
        const { container } = render(
            <IframeWidget
                widget={makeWidget({
                    url: 'https://example.com',
                    hideScrollbar: true,
                    allowInteraction: false,
                })}
                isEditMode={false}
            />,
        );
        const wrap = container.querySelector('.iframe-container');
        expect(wrap?.classList.contains('iframe-hide-scrollbar')).toBe(true);
        expect(wrap?.classList.contains('iframe-no-interact')).toBe(true);
    });
});

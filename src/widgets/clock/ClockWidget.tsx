/**
 * Clock Widget
 *
 * Displays current time with timezone support.
 * CSS container queries set an aggressive target size; a ResizeObserver
 * pass shrinks the time to fit available width so long 12h strings never overflow.
 *
 * Fit avoids flicker by never flashing the full CSS size on every RO tick:
 * shrink from the current size, and only probe growing back with hysteresis.
 */

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { ClockWidgetProps, ClockPreferences, ClockConfig } from './types';
import './styles.css';

// Static preview time: Tuesday, December 24, 2024 at 12:34:56 PM
const PREVIEW_TIME = new Date(2024, 11, 24, 12, 34, 56);

const FIT_EPSILON_PX = 0.5;
/** Only re-grow toward CSS size when this much unused width is available */
const GROW_SLACK_RATIO = 0.08;

function availableTimeWidth(contentEl: HTMLElement): number {
    const contentWidth = contentEl.clientWidth;
    if (contentWidth <= 0) return 0;

    const contentStyle = getComputedStyle(contentEl);
    const isStacked =
        contentStyle.display === 'grid' ||
        contentStyle.flexDirection === 'column';

    const infoEl = contentEl.querySelector('.clock-widget__info') as HTMLElement | null;
    const infoVisible =
        !!infoEl &&
        getComputedStyle(infoEl).display !== 'none' &&
        infoEl.offsetWidth > 0;

    const gap = parseFloat(contentStyle.columnGap || contentStyle.gap) || 0;
    if (!isStacked && infoVisible && infoEl) {
        return Math.max(0, contentWidth - infoEl.offsetWidth - gap);
    }
    return contentWidth;
}

function measureScrollWidth(timeEl: HTMLElement): number {
    const prevWhiteSpace = timeEl.style.whiteSpace;
    timeEl.style.whiteSpace = 'nowrap';
    const width = timeEl.scrollWidth;
    timeEl.style.whiteSpace = prevWhiteSpace;
    return width;
}

function setFontSizeIfChanged(timeEl: HTMLElement, next: string): void {
    if (timeEl.style.fontSize === next) return;
    if (next === '') {
        timeEl.style.fontSize = '';
        return;
    }
    const prev = parseFloat(timeEl.style.fontSize);
    const nextPx = parseFloat(next);
    if (Number.isFinite(prev) && Number.isFinite(nextPx) && Math.abs(prev - nextPx) < FIT_EPSILON_PX) {
        return;
    }
    timeEl.style.fontSize = next;
}

function fitTimeToWidth(timeEl: HTMLElement, contentEl: HTMLElement): void {
    const available = availableTimeWidth(contentEl);
    if (available <= 0) return;

    const currentWidth = measureScrollWidth(timeEl);

    // Overflowing: shrink from the current rendered size (no CSS-size flash)
    if (currentWidth > available) {
        const currentSize = parseFloat(getComputedStyle(timeEl).fontSize);
        if (!Number.isFinite(currentSize) || currentSize <= 0) return;
        setFontSizeIfChanged(
            timeEl,
            `${currentSize * ((available * 0.98) / currentWidth)}px`
        );
        return;
    }

    // Already at pure CSS size and fits — nothing to do
    if (!timeEl.style.fontSize) return;

    // Fitted smaller earlier. Only probe growing back when there's clear slack,
    // so RO/subpixel noise at breakpoints can't oscillate.
    const slack = available - currentWidth;
    if (slack < available * GROW_SLACK_RATIO) return;

    const inlineBefore = timeEl.style.fontSize;
    timeEl.style.fontSize = '';
    const cssSize = parseFloat(getComputedStyle(timeEl).fontSize);
    const cssWidth = measureScrollWidth(timeEl);

    if (!Number.isFinite(cssSize) || cssSize <= 0) {
        timeEl.style.fontSize = inlineBefore;
        return;
    }

    if (cssWidth <= available) {
        // CSS size fits — keep cleared
        return;
    }

    const fitted = `${cssSize * ((available * 0.98) / cssWidth)}px`;
    const fittedPx = parseFloat(fitted);
    const prevPx = parseFloat(inlineBefore);
    if (Number.isFinite(prevPx) && Number.isFinite(fittedPx) && Math.abs(fittedPx - prevPx) < FIT_EPSILON_PX) {
        timeEl.style.fontSize = inlineBefore;
        return;
    }
    setFontSizeIfChanged(timeEl, fitted);
}

const ClockWidget = ({ widget, previewMode = false }: ClockWidgetProps): React.JSX.Element => {
    // In preview mode, use frozen time; otherwise use live time
    const [time, setTime] = useState<Date>(previewMode ? PREVIEW_TIME : new Date());
    const contentRef = useRef<HTMLDivElement>(null);
    const timeRef = useRef<HTMLDivElement>(null);

    // Get active config from widget.config
    const config = widget.config as ClockConfig | undefined;
    const activeConfig: ClockPreferences = {
        format24h: config?.format24h ?? false,
        timezone: config?.timezone ?? '',
        showDate: config?.showDate ?? true,
        showSeconds: config?.showSeconds ?? false // Default to false for cleaner preview
    };

    const { format24h, timezone, showDate, showSeconds } = activeConfig;

    useEffect(() => {
        // Skip interval in preview mode - keep frozen time
        if (previewMode) return;

        const interval = setInterval(() => setTime(new Date()), showSeconds ? 1000 : 60000);
        return () => clearInterval(interval);
    }, [showSeconds, previewMode]);

    const formatTime = (date: Date): string => {
        const options: Intl.DateTimeFormatOptions = {
            hour: format24h ? '2-digit' : 'numeric',
            minute: '2-digit',
            ...(showSeconds && { second: '2-digit' }),
            hour12: !format24h,
            ...(timezone && { timeZone: timezone })
        };
        return date.toLocaleTimeString([], options);
    };

    const formatDate = (date: Date): string => {
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            ...(timezone && { timeZone: timezone })
        };
        return date.toLocaleDateString([], options);
    };

    const timeText = formatTime(time);

    // Refit when the visible string / secondary chrome changes (before paint)
    useLayoutEffect(() => {
        const timeEl = timeRef.current;
        const contentEl = contentRef.current;
        if (!timeEl || !contentEl) return;
        fitTimeToWidth(timeEl, contentEl);
    }, [timeText, showDate, timezone, format24h, showSeconds]);

    // Refit on container resize; rAF-coalesce to avoid RO feedback flicker
    useLayoutEffect(() => {
        const timeEl = timeRef.current;
        const contentEl = contentRef.current;
        const rootEl = contentEl?.closest('.clock-widget') as HTMLElement | null;
        if (!timeEl || !contentEl) return;

        let rafId = 0;
        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                fitTimeToWidth(timeEl, contentEl);
            });
        });
        ro.observe(rootEl ?? contentEl);
        return () => {
            cancelAnimationFrame(rafId);
            ro.disconnect();
        };
    }, []);

    return (
        <div className="clock-widget">
            <div className="clock-widget__content" ref={contentRef}>
                {/* Time Display */}
                <div className="clock-widget__time" ref={timeRef}>
                    {timeText}
                </div>

                {/* Date and Timezone Display */}
                <div className="clock-widget__info">
                    {showDate && (
                        <div className="clock-widget__date">
                            {formatDate(time)}
                        </div>
                    )}
                    {timezone && (
                        <div className="clock-widget__timezone">
                            {timezone}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClockWidget;

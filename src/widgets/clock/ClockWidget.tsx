/**
 * Clock Widget
 * 
 * Displays current time with timezone support.
 * Uses CSS Container Queries for responsive scaling.
 */

import React, { useState, useEffect } from 'react';
import { ClockWidgetProps, ClockPreferences, ClockConfig } from './types';
import './styles.css';

// Static preview time: Tuesday, December 24, 2024 at 12:34:56 PM
const PREVIEW_TIME = new Date(2024, 11, 24, 12, 34, 56);

const ClockWidget = ({ widget, previewMode = false }: ClockWidgetProps): React.JSX.Element => {
    // In preview mode, use frozen time; otherwise use live time
    const [time, setTime] = useState<Date>(previewMode ? PREVIEW_TIME : new Date());

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

    return (
        <div className="clock-widget">
            <div className="clock-widget__content">
                {/* Time Display */}
                <div className="clock-widget__time">
                    {formatTime(time)}
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

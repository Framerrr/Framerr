import React from 'react';
import {
    MockPlexWidget,
    MockRadarrWidget,
    MockSonarrWidget,
    MockQBittorrentWidget,
    MockSystemStatusWidget,
    MockServiceStatusWidget,
    MockCalendarWidget,
    MockClockWidget,
    MockWeatherWidget,
    MockLinkGridWidget,
    MockOverseerrWidget,
    MockUpcomingMediaWidget,
    MockCustomHTMLWidget,
    MockGenericWidget,
} from './MockWidgets';

export const getMockWidget = (type: string): React.FC => {
    const widgets: Record<string, React.FC> = {
        'media-stream': MockPlexWidget,
        'plex': MockPlexWidget,
        'radarr': MockRadarrWidget,
        'sonarr': MockSonarrWidget,
        'downloads': MockQBittorrentWidget,
        'system-status': MockSystemStatusWidget,
        'service-status': MockServiceStatusWidget,
        'calendar': MockCalendarWidget,
        'clock': MockClockWidget,
        'weather': MockWeatherWidget,
        'link-grid': MockLinkGridWidget,
        'overseerr': MockOverseerrWidget,
        'upcomingmedia': MockUpcomingMediaWidget,
        'custom-html': MockCustomHTMLWidget,
    };

    return widgets[type.toLowerCase()] || (() => <MockGenericWidget type={type} />);
};

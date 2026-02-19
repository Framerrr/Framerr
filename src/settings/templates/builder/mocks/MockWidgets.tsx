/**
 * MockWidgets - Accurate visual replicas of real widgets
 * 
 * ANALYSIS OF REAL WIDGET BEHAVIOR:
 * 
 * PLEX:
 * - Layout: CSS Grid with `repeat(auto-fill, minmax(220px, 1fr))`
 * - Overflow: `overflowY: auto` (scrolls vertically)
 * - Gap: 1rem (16px)
 * - Padding: 0.25rem
 * - Card: bg-hover, 8px radius, boxShadow, 70% image container
 * - Content: 6px progress bar, title (0.85rem bold), subtitle (0.7rem)
 * 
 * SONARR/RADARR:
 * - Layout: Flex column, gap 0.5rem
 * - Header: "Upcoming Episodes/Movies" text
 * - Items: Button with rgba(255,255,255,0.05) bg, 0.5rem padding
 * - Text: Title bold, subtitle 0.75rem secondary
 * 
 * CALENDAR:
 * - Layout: flex-col with header, filters, 7-col grid
 * - Header: Month navigation with chevrons + "Today" button
 * - Filters: All/TV/Movies buttons
 * - Grid: 7 columns, 2px gaps, min-h-50px cells
 * 
 * CLOCK:
 * - Layout: flex center, responsive isWide detection at 410px
 * - Wide: flex-row with gap-6, time 4xl
 * - Narrow: flex-col, time 5xl
 * - Date: text-base/sm, optional
 * 
 * WEATHER:
 * - Layout: flex center, responsive isWide detection at 410px
 * - Wide: flex-row with icon, temp (5xl), info column
 * - Narrow: flex-col centered, temp (5xl) + icon row
 * 
 * LINK-GRID:
 * - Layout: 6-column grid with 80px min cells
 * - Items: Circles (1x1) or Rectangles (2x1)
 * - Gap: 8px mobile, 16px desktop
 * 
 * QBITTORRENT:
 * - Layout: flex-col with stats row + torrent list
 * - Stats: 3-column grid for Total, DL, UL
 * - Torrents: List with progress bars
 * 
 * SYSTEM-STATUS:
 * - Layout: flex-col with metric rows
 * - Each row: icon + label + value + progress bar
 */

import React from 'react';
import {
    Film, ArrowDown, ArrowUp, Activity, Disc, Thermometer, Clock,
    Globe, Music, Sun, Code, ChevronLeft, ChevronRight, Filter, MapPin,
    Link, Tv
} from 'lucide-react';

// =============================================================================
// PLEX WIDGET - Horizontal card grid (overflow hidden for thumbnail)
// =============================================================================
const PLEX_MOCK_DATA = [
    { title: "Breaking Bad", subtitle: "S5 • E16", user: "JohnDoe", progress: 65 },
    { title: "The Office", subtitle: "S7 • E11", user: "Jane", progress: 23 },
    { title: "Interstellar", subtitle: "Movie", user: "Mike", progress: 89 },
];

export const MockPlexWidget: React.FC = () => (
    <div style={{
        display: 'flex',
        gap: '0.75rem',
        height: '100%',
        overflowX: 'hidden',
        overflowY: 'hidden',
        padding: '0.25rem',
        alignItems: 'stretch',
    }}>
        {PLEX_MOCK_DATA.map((session, i) => (
            <div
                key={i}
                style={{
                    minWidth: '140px',
                    flex: '0 0 140px',
                    background: 'var(--bg-hover)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
            >
                {/* Image Container - 60% height */}
                <div style={{
                    flex: '0 0 60%',
                    background: `linear-gradient(135deg, var(--accent) 0%, var(--bg-tertiary) 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Film size={20} style={{ opacity: 0.3, color: 'white' }} />
                </div>

                {/* Progress Bar */}
                <div style={{ height: '4px', background: 'var(--bg-tertiary)' }}>
                    <div style={{
                        width: `${session.progress}%`,
                        background: 'var(--accent)',
                        height: '100%',
                    }} />
                </div>

                {/* Info */}
                <div style={{ padding: '0.4rem', flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.7rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.title}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                        <span>{session.subtitle}</span>
                        <span>{session.user}</span>
                    </div>
                </div>
            </div>
        ))}
    </div>
);

// =============================================================================
// RADARR WIDGET - Vertical list with buttons
// =============================================================================
const RADARR_MOCK_DATA = [
    { title: "Dune: Part Two", year: 2024, release: "Mar 1" },
    { title: "Oppenheimer", year: 2023, release: "Jul 21" },
    { title: "Barbie", year: 2023, release: "Jul 21" },
    { title: "Avatar 3", year: 2025, release: "Dec 19" },
    { title: "Deadpool 4", year: 2025, release: "TBA" },
];

export const MockRadarrWidget: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', height: '100%', overflow: 'hidden' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.1rem' }}>Upcoming Movies</div>
        {RADARR_MOCK_DATA.map((movie, i) => (
            <div
                key={i}
                style={{
                    padding: '0.35rem 0.5rem',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '0.35rem',
                    fontSize: '0.7rem',
                }}
            >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {movie.title}
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                    {movie.year} • {movie.release}
                </div>
            </div>
        ))}
    </div>
);

// =============================================================================
// SONARR WIDGET - Same style as Radarr
// =============================================================================
const SONARR_MOCK_DATA = [
    { title: "The Last of Us", info: "S2E3 • Jan 19" },
    { title: "House of Dragon", info: "S3E1 • Jun 15" },
    { title: "The Bear", info: "S4E1 • Jun 22" },
    { title: "Severance", info: "S2E6 • Feb 14" },
    { title: "Wednesday", info: "S2E1 • Aug 1" },
];

export const MockSonarrWidget: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', height: '100%', overflow: 'hidden' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.1rem' }}>Upcoming Episodes</div>
        {SONARR_MOCK_DATA.map((show, i) => (
            <div
                key={i}
                style={{
                    padding: '0.35rem 0.5rem',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '0.35rem',
                    fontSize: '0.7rem',
                }}
            >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {show.title}
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                    {show.info}
                </div>
            </div>
        ))}
    </div>
);

// =============================================================================
// QBITTORRENT WIDGET - Stats + torrent list
// =============================================================================
export const MockQBittorrentWidget: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%', overflow: 'hidden' }}>
        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', fontSize: '0.65rem' }}>
            <div style={{ textAlign: 'center', padding: '0.35rem', borderRadius: '0.35rem', background: 'var(--bg-tertiary)' }}>
                <div style={{ color: 'var(--text-secondary)' }}>Total</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>47</div>
            </div>
            <div style={{ textAlign: 'center', padding: '0.35rem', borderRadius: '0.35rem', background: 'rgba(34,197,94,0.1)' }}>
                <div style={{ color: 'var(--text-secondary)' }}>↓ 12.5 MB/s</div>
                <div style={{ fontWeight: 600, color: 'var(--success)' }}>3 DL</div>
            </div>
            <div style={{ textAlign: 'center', padding: '0.35rem', borderRadius: '0.35rem', background: 'rgba(59,130,246,0.1)' }}>
                <div style={{ color: 'var(--text-secondary)' }}>↑ 2.1 MB/s</div>
                <div style={{ fontWeight: 600, color: 'var(--info)' }}>5 UP</div>
            </div>
        </div>

        {/* Torrent List */}
        {[
            { name: "ubuntu-22.04.iso", progress: 87 },
            { name: "LinuxMint-21.iso", progress: 23 },
            { name: "debian-12.iso", progress: 100 },
        ].map((t, i) => (
            <div key={i} style={{ padding: '0.35rem', borderRadius: '0.35rem', background: 'var(--bg-tertiary)', fontSize: '0.6rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.2rem' }}>
                    {t.name}
                </div>
                <div style={{ height: '3px', borderRadius: '999px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
                    <div style={{ width: `${t.progress}%`, height: '100%', background: t.progress < 100 ? 'var(--success)' : 'var(--text-secondary)' }} />
                </div>
            </div>
        ))}
    </div>
);

// =============================================================================
// SYSTEM STATUS WIDGET - Metric bars
// =============================================================================
export const MockSystemStatusWidget: React.FC = () => {
    const metrics = [
        { icon: Activity, label: 'CPU', value: 45, unit: '%' },
        { icon: Disc, label: 'Memory', value: 68, unit: '%' },
        { icon: Thermometer, label: 'Temp', value: 52, unit: '°C' },
        { icon: Clock, label: 'Uptime', value: null, display: '14d 6h' },
    ];

    const getColor = (v: number) => v < 50 ? 'var(--success)' : v < 80 ? 'var(--warning)' : 'var(--error)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem', height: '100%', justifyContent: 'space-around' }}>
            {metrics.map((m, i) => (
                <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', fontSize: '0.7rem', color: 'var(--text-primary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <m.icon size={12} />
                            {m.label}
                        </span>
                        <span>{m.display || `${m.value}${m.unit}`}</span>
                    </div>
                    {m.value !== null && (
                        <div style={{ height: '4px', borderRadius: '999px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                            <div style={{ width: `${m.value}%`, height: '100%', background: getColor(m.value), borderRadius: '999px' }} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// =============================================================================
// CALENDAR WIDGET - Month grid with header
// =============================================================================
export const MockCalendarWidget: React.FC = () => {
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const eventDays = [5, 12, 18, 23, 28];

    return (
        <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.25rem' }}>
                <ChevronLeft size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>December 2024</span>
                <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                <Filter size={10} style={{ color: 'var(--text-tertiary)' }} />
                {['All', 'TV', 'Movies'].map((f, i) => (
                    <span key={f} style={{ fontSize: '0.5rem', padding: '0.1rem 0.3rem', borderRadius: '0.2rem', background: i === 0 ? 'var(--accent)' : 'var(--bg-tertiary)', color: i === 0 ? 'white' : 'var(--text-secondary)' }}>{f}</span>
                ))}
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} style={{ fontSize: '0.5rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>{d}</div>
                ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', flex: 1 }}>
                {/* Empty cells for month start */}
                {Array.from({ length: 0 }).map((_, i) => <div key={`e${i}`} />)}
                {days.slice(0, 28).map((day) => (
                    <div key={day} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', color: 'var(--text-primary)', background: 'var(--bg-tertiary)', borderRadius: '2px', minHeight: '14px' }}>
                        {day}
                        {eventDays.includes(day) && <div style={{ position: 'absolute', bottom: '1px', width: '3px', height: '3px', borderRadius: '50%', background: 'var(--accent)' }} />}
                    </div>
                ))}
            </div>
        </div>
    );
};

// =============================================================================
// CLOCK WIDGET - Centered time display
// =============================================================================
export const MockClockWidget: React.FC = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>12:34</div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Tuesday, December 24</div>
    </div>
);

// =============================================================================
// WEATHER WIDGET - Temp + conditions
// =============================================================================
export const MockWeatherWidget: React.FC = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.55rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            <MapPin size={8} />
            <span>New York, NY</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>42°</span>
            <Sun size={24} style={{ color: 'var(--warning)', opacity: 0.8 }} />
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Sunny</div>
        <div style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)' }}>H: 48° · L: 35°</div>
    </div>
);

// =============================================================================
// LINK GRID WIDGET - Grid of link icons (1x1 circles and 2x1 rectangles)
// =============================================================================
const LINK_MOCK_DATA = [
    { name: 'GitHub', shape: '1x1' as const },
    { name: 'Plex', shape: '2x1' as const },
    { name: 'Google', shape: '1x1' as const },
    { name: 'Discord', shape: '1x1' as const },
];

export const MockLinkGridWidget: React.FC = () => (
    <div style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        alignItems: 'center',
        justifyContent: 'center',
        alignContent: 'center',
        padding: '6px',
    }}>
        {LINK_MOCK_DATA.map((link, i) => (
            <div
                key={i}
                style={{
                    width: link.shape === '2x1' ? '80px' : '40px',
                    height: '40px',
                    borderRadius: link.shape === '2x1' ? '8px' : '50%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                }}
            >
                <Link size={16} style={{ color: 'var(--accent)' }} />
                {link.shape === '2x1' && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {link.name}
                    </span>
                )}
            </div>
        ))}
    </div>
);

// =============================================================================
// OVERSEERR WIDGET - Horizontal poster carousel (matches real widget)
// =============================================================================
export const MockOverseerrWidget: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header with scroll buttons */}
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '24px',
            marginBottom: '8px',
            flexShrink: 0
        }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Recent Requests
            </span>
            <div style={{ display: 'flex', gap: '2px' }}>
                <div style={{
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)'
                }}>
                    <ChevronLeft size={10} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <div style={{
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)'
                }}>
                    <ChevronRight size={10} style={{ color: 'var(--text-secondary)' }} />
                </div>
            </div>
        </div>

        {/* Horizontal poster carousel */}
        <div style={{
            display: 'flex',
            gap: '8px',
            flex: 1,
            overflowX: 'hidden',
            overflowY: 'hidden',
            alignItems: 'stretch'
        }}>
            {[
                { title: "Dune 3", status: "Pending", color: "var(--warning)" },
                { title: "Avatar 4", status: "Approved", color: "var(--success)" },
                { title: "Batman 2", status: "Pending", color: "var(--warning)" },
            ].map((item, i) => (
                <div
                    key={i}
                    style={{
                        height: '100%',
                        aspectRatio: '2/3',
                        flexShrink: 0,
                        borderRadius: '6px',
                        overflow: 'hidden',
                        position: 'relative',
                        background: `linear-gradient(135deg, var(--accent) 0%, var(--bg-tertiary) 100%)`,
                    }}
                >
                    {/* Poster placeholder */}
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Film size={16} style={{ opacity: 0.3, color: 'white' }} />
                    </div>

                    {/* Status badge */}
                    <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        fontSize: '0.4rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: 'rgba(0,0,0,0.8)',
                        color: item.color,
                        border: `1px solid ${item.color}40`
                    }}>
                        {item.status}
                    </div>

                    {/* Title gradient overlay */}
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '12px 4px 4px 4px',
                        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}>
                        <span style={{
                            fontSize: '0.5rem',
                            fontWeight: 600,
                            color: 'white',
                            textAlign: 'center',
                            lineHeight: 1.2
                        }}>
                            {item.title}
                        </span>
                        <span style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.7)' }}>
                            User
                        </span>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// =============================================================================
// CUSTOM HTML WIDGET
// =============================================================================
export const MockCustomHTMLWidget: React.FC = () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Code size={20} style={{ color: 'var(--text-tertiary)', marginRight: '0.35rem' }} />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Custom HTML</span>
    </div>
);

// =============================================================================
// UPCOMING MEDIA WIDGET
// =============================================================================
export const MockUpcomingMediaWidget: React.FC = () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem', overflow: 'hidden' }}>
        {[1, 2, 3].map((_, i) => (
            <div key={i} style={{ width: '50px', height: '70px', borderRadius: '4px', background: `linear-gradient(135deg, var(--accent) 0%, var(--bg-tertiary) 100%)`, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Film size={16} style={{ opacity: 0.3, color: 'white' }} />
            </div>
        ))}
    </div>
);

// =============================================================================
// GENERIC FALLBACK
// =============================================================================
export const MockGenericWidget: React.FC<{ type: string }> = ({ type }) => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{type}</span>
    </div>
);

// =============================================================================
// SERVICE STATUS WIDGET - Grid of service monitors with status dots
// =============================================================================
const SERVICE_MOCK_DATA = [
    { name: 'Plex', status: 'up' as const },
    { name: 'Sonarr', status: 'up' as const },
    { name: 'Radarr', status: 'down' as const },
    { name: 'Overseerr', status: 'up' as const },
];

export const MockServiceStatusWidget: React.FC = () => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'up': return 'var(--success)';
            case 'down': return 'var(--error)';
            case 'degraded': return 'var(--warning)';
            default: return 'var(--text-tertiary)';
        }
    };

    return (
        <div style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            alignItems: 'center',
            justifyContent: 'center',
            alignContent: 'center',
        }}>
            {SERVICE_MOCK_DATA.map((service, i) => (
                <div
                    key={i}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '48px',
                        height: '48px',
                        padding: '4px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        gap: '2px',
                    }}
                >
                    {/* Icon placeholder */}
                    <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        background: 'var(--bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Globe size={12} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                    {/* Name */}
                    <span style={{
                        fontSize: '0.5rem',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '44px',
                        textAlign: 'center',
                    }}>
                        {service.name}
                    </span>
                    {/* Status dot */}
                    <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: getStatusColor(service.status),
                    }} />
                </div>
            ))}
        </div>
    );
};

// =============================================================================
// WIDGET TYPE MAPPING
// =============================================================================
export const getMockWidget = (type: string): React.FC => {
    const widgets: Record<string, React.FC> = {
        'media-stream': MockPlexWidget,  // New canonical widget type
        'plex': MockPlexWidget,           // Legacy/backward compatibility
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


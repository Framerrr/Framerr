/**
 * WidgetStateTestPage - Visual Test Page for Widget State Messages
 * 
 * Displays all WidgetStateMessage variants in various widget sizes
 * for visual approval before migrating widgets.
 * 
 * Access via: /#dev/widget-states
 */

import React, { useState } from 'react';
import { WidgetStateMessage } from '../../shared/widgets';
import {
    Play,
    Tv,
    ServerOff,
    Calendar
} from 'lucide-react';

const WIDGET_SIZES = [
    { name: 'Large', w: 400, h: 300 },
    { name: 'Medium', w: 250, h: 200 },
    { name: 'Small', w: 180, h: 150 },
    { name: 'Compact', w: 120, h: 100 },
    { name: 'Tiny', w: 80, h: 70 },
];

const WidgetStateTestPage: React.FC = () => {
    const [isAdmin, setIsAdmin] = useState(true);
    const [selectedSize, setSelectedSize] = useState(WIDGET_SIZES[1]); // Medium default

    const mockErrorDetails = `Error: Failed to fetch data from API
    at fetchData (widget.tsx:45:12)
    at SonarrWidget (SonarrWidget.tsx:123:8)
    at renderWithHooks (react-dom.development.js:14985:18)
    at mountIndeterminateComponent (react-dom.development.js:17811:13)
    at beginWork (react-dom.development.js:19049:16)`;

    const variants = [
        { variant: 'loading' as const, serviceName: undefined },
        { variant: 'error' as const, serviceName: 'Sonarr', message: 'Failed to fetch calendar data' },
        { variant: 'disabled' as const, serviceName: 'Plex' },
        { variant: 'notConfigured' as const, serviceName: 'Radarr' },
        { variant: 'noAccess' as const, serviceName: 'qBittorrent' },
        { variant: 'noAccess' as const, serviceName: undefined },
        {
            variant: 'crash' as const,
            serviceName: undefined,
            message: 'Cannot read property of undefined',
            errorDetails: mockErrorDetails
        },
        {
            variant: 'empty' as const,
            serviceName: undefined,
            emptyIcon: Calendar,
            emptyTitle: 'No Upcoming Shows',
            emptySubtitle: 'Nothing scheduled for today'
        },
    ];

    return (
        <div className="p-8 min-h-screen">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="space-y-4">
                    <h1 className="text-3xl font-bold text-theme-primary">
                        Widget State Message Test
                    </h1>
                    <p className="text-theme-secondary">
                        Preview all widget state variants at different sizes before applying to widgets.
                    </p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap gap-4 items-center p-4 bg-theme-secondary rounded-xl">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-theme-primary">Admin Mode:</label>
                        <button
                            onClick={() => setIsAdmin(!isAdmin)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${isAdmin
                                ? 'bg-accent text-white'
                                : 'bg-theme-tertiary text-theme-secondary'
                                }`}
                        >
                            {isAdmin ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-theme-primary">Preview Size:</label>
                        <div className="flex gap-1">
                            {WIDGET_SIZES.map(size => (
                                <button
                                    key={size.name}
                                    onClick={() => setSelectedSize(size)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${selectedSize.name === size.name
                                        ? 'bg-accent text-white'
                                        : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                                        }`}
                                >
                                    {size.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Variant Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {variants.map((props) => (
                        <div key={props.variant} className="space-y-2">
                            {/* Label */}
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-theme-primary uppercase tracking-wider">
                                    {props.variant}
                                </h3>
                                <span className="text-xs text-theme-tertiary">
                                    {selectedSize.w}×{selectedSize.h}
                                </span>
                            </div>

                            {/* Widget Preview */}
                            <div
                                className="bg-theme-secondary rounded-xl border border-theme overflow-hidden"
                                style={{
                                    width: selectedSize.w,
                                    height: selectedSize.h,
                                }}
                            >
                                <WidgetStateMessage
                                    {...props}
                                    isAdmin={isAdmin}
                                    onRetry={
                                        (props.variant === 'error' || props.variant === 'crash')
                                            ? () => alert('Retry clicked!')
                                            : undefined
                                    }
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* All Sizes Comparison */}
                <div className="space-y-4 pt-8 border-t border-theme">
                    <h2 className="text-xl font-bold text-theme-primary">
                        Container Query Scaling Demo
                    </h2>
                    <p className="text-sm text-theme-secondary">
                        Same variant at all sizes to demonstrate responsive scaling:
                    </p>

                    <div className="flex flex-wrap gap-4 items-end">
                        {WIDGET_SIZES.map(size => (
                            <div key={size.name} className="space-y-1">
                                <span className="text-xs text-theme-tertiary">
                                    {size.name} ({size.w}×{size.h})
                                </span>
                                <div
                                    className="bg-theme-secondary rounded-xl border border-theme overflow-hidden"
                                    style={{
                                        width: size.w,
                                        height: size.h,
                                    }}
                                >
                                    <WidgetStateMessage
                                        variant="disabled"
                                        serviceName="Plex"
                                        isAdmin={isAdmin}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Back Link */}
                <div className="pt-8">
                    <a
                        href="#dashboard"
                        className="text-accent hover:underline"
                    >
                        ← Back to Dashboard
                    </a>
                </div>
            </div>
        </div>
    );
};

export default WidgetStateTestPage;

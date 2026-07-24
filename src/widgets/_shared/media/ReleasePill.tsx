/**
 * ReleasePill - Shared release-type indicator
 *
 * Single source of truth for release type display across Radarr, Sonarr,
 * and Calendar widgets. Color always encodes release *type*, never status —
 * see docs/private/widgets/WIDGET_REDESIGN_MEDIA.md §0.1/§0.2.
 */

import React from 'react';

export type ReleaseType = 'cinema' | 'digital' | 'physical' | 'tv' | 'music' | 'missing';

const TYPE_LABELS: Record<ReleaseType, string> = {
    cinema: 'Cinema',
    digital: 'Digital',
    physical: 'Physical',
    tv: 'TV',
    music: 'Music',
    missing: 'Missing',
};

export interface ReleasePillProps {
    type: ReleaseType;
    /** Display text for the date (e.g. "Jul 25", "TBA"). Ignored for type="missing". */
    date?: string;
    /** Dims the pill to 45% opacity — used for TBA-but-type-known states. */
    dimmed?: boolean;
    /** Prefixes the date with the type's label (e.g. "Cinema Jul 25"). Off by default — space-constrained contexts (Hero, mini-cards) rely on color alone. */
    showLabel?: boolean;
    className?: string;
}

export const ReleasePill: React.FC<ReleasePillProps> = ({ type, date, dimmed, showLabel, className }) => {
    const classes = ['media-release-pill', `media-release-pill--${type}`];
    if (dimmed) classes.push('media-release-pill--dimmed');
    if (className) classes.push(className);

    return (
        <span className={classes.join(' ')} data-type={type}>
            <span className="media-release-pill-dot" aria-hidden="true" />
            {type !== 'missing' && date && (
                showLabel ? (
                    <>
                        {/* Container query in media.css swaps to the short form when the
                         * widget is too narrow for the type label to fit comfortably. */}
                        <span className="media-release-pill-date media-release-pill-date--full">
                            {TYPE_LABELS[type]} {date}
                        </span>
                        <span className="media-release-pill-date media-release-pill-date--short">
                            {date}
                        </span>
                    </>
                ) : (
                    <span className="media-release-pill-date">{date}</span>
                )
            )}
        </span>
    );
};

export default ReleasePill;

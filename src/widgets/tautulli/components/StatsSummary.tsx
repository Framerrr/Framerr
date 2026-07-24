/**
 * StatsSummary - Compact inline library stats strip (movies/shows/plays/watch time).
 *
 * See docs/private/widgets/WIDGET_REDESIGN_MEDIA.md §4.2.
 */

import React, { useRef, useCallback } from 'react';
import { Film, Tv, Play, Clock } from 'lucide-react';
import { formatCount, formatDuration } from '../utils';
import type { TautulliLibrary } from '../tautulli.types';

interface StatsSummaryProps {
    libraries: TautulliLibrary[];
}

const StatsSummary = React.memo(({ libraries }: StatsSummaryProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const movieCount = libraries.filter(l => l.sectionType === 'movie').reduce((s, l) => s + l.count, 0);
    const showCount = libraries.filter(l => l.sectionType === 'show').reduce((s, l) => s + l.count, 0);
    const totalPlays = libraries.reduce((s, l) => s + l.plays, 0);
    const totalDuration = libraries.reduce((s, l) => s + l.duration, 0);

    // Build stat items based on available content
    const items: { icon: React.ElementType; value: string; label: string }[] = [];
    if (movieCount > 0) items.push({ icon: Film, value: formatCount(movieCount), label: 'Movies' });
    if (showCount > 0) items.push({ icon: Tv, value: formatCount(showCount), label: 'Shows' });
    if (totalPlays > 0) items.push({ icon: Play, value: formatCount(totalPlays), label: 'Plays' });
    if (totalDuration > 0) items.push({ icon: Clock, value: formatDuration(totalDuration), label: 'Watch Time' });

    // Detect which items start a new visual row and mark them
    const updateWrapClasses = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        const children = Array.from(el.querySelectorAll('.tautulli-stats-item'));
        let lastTop = -1;
        children.forEach((child, i) => {
            const top = (child as HTMLElement).getBoundingClientRect().top;
            if (i === 0 || (lastTop !== -1 && Math.abs(top - lastTop) > 2)) {
                child.classList.add('wrap-start');
            } else {
                child.classList.remove('wrap-start');
            }
            lastTop = top;
        });
    }, []);

    React.useLayoutEffect(() => {
        updateWrapClasses();
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(updateWrapClasses);
        ro.observe(el);
        return () => ro.disconnect();
    }, [updateWrapClasses, items.length]);

    if (items.length === 0) return null;

    return (
        <div ref={containerRef} className="tautulli-stats-summary">
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <span key={item.label} className="tautulli-stats-item">
                        <Icon size={11} />
                        <span className="tautulli-stats-value">{item.value}</span>
                        <span className="tautulli-stats-label">{item.label}</span>
                    </span>
                );
            })}
        </div>
    );
});

StatsSummary.displayName = 'StatsSummary';

export default StatsSummary;

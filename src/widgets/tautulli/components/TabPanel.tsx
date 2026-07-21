/**
 * TabPanel — one Tautulli content tab: adaptive featured band + remainder list.
 */

import React, { useEffect, useRef, useState } from 'react';
import { splitFeatured } from '../featuredLayout';
import FeaturedBand, { type FeaturedBandItem } from './FeaturedBand';
import RemainderList, { type RemainderListItem } from './RemainderList';

export interface TabPanelRow {
    key: string;
    title: string;
    subtitle?: string;
    meta: string;
    /** Preferred wide image (art/backdrop) for featured cards */
    featuredImageUrl: string | null;
    /** Poster fallback if featured art fails to load */
    featuredFallbackUrl?: string | null;
    /** Poster / avatar for list rows (and user featured fallback) */
    listImageUrl: string | null;
    variant: 'content' | 'user';
    mediaType?: string;
}

interface TabPanelProps {
    rows: TabPanelRow[];
    /** Max rows shown in the remainder list */
    listLimit: number;
    emptyLabel: string;
}

const TabPanel = ({ rows, listLimit, emptyLabel }: TabPanelProps): React.JSX.Element => {
    const rootRef = useRef<HTMLDivElement>(null);
    const [widthPx, setWidthPx] = useState(400);

    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width;
            if (typeof w === 'number' && w > 0) setWidthPx(w);
        });
        ro.observe(el);
        setWidthPx(el.clientWidth || 400);
        return () => ro.disconnect();
    }, []);

    if (rows.length === 0) {
        return (
            <div ref={rootRef} className="tautulli-tab-panel">
                <div className="tautulli-stats-status text-theme-secondary" role="status">
                    {emptyLabel}
                </div>
            </div>
        );
    }

    const { featured, remainder } = splitFeatured(rows, widthPx);
    const listRows = remainder.slice(0, listLimit);

    const featuredItems: FeaturedBandItem[] = featured.map((row) => ({
        key: row.key,
        title: row.title,
        meta: row.meta,
        imageUrl: row.variant === 'user' ? null : row.featuredImageUrl || row.listImageUrl,
        fallbackImageUrl: row.variant === 'user' ? null : row.featuredFallbackUrl || row.listImageUrl,
        avatarUrl: row.variant === 'user' ? row.listImageUrl : null,
        variant: row.variant,
        mediaType: row.mediaType,
    }));

    const remainderItems: RemainderListItem[] = listRows.map((row) => ({
        key: row.key,
        title: row.title,
        subtitle: row.subtitle,
        meta: row.meta,
        imageUrl: row.listImageUrl,
        variant: row.variant === 'user' ? 'avatar' : 'poster',
        mediaType: row.mediaType,
    }));

    return (
        <div ref={rootRef} className="tautulli-tab-panel">
            <FeaturedBand items={featuredItems} />
            <RemainderList items={remainderItems} startRank={featured.length} />
        </div>
    );
};

export default TabPanel;

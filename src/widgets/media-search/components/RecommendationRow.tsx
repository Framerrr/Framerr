/**
 * RecommendationRow
 *
 * A flex row of poster cards shown in the search overlay when no query is typed.
 * Displays personalized ("For You") or random ("From Your Library") recommendations.
 * 
 * Cards dynamically resize to perfectly fill the available width — no cutoffs,
 * no gaps, no partial cards. The number of visible cards and their width are
 * calculated from the container width using a ResizeObserver.
 */

import React, { useRef, useState, useEffect } from 'react';
import { Sparkles, Library, Film, Tv } from 'lucide-react';
import './RecommendationRow.css';
import type { RecommendationItem } from '../hooks/useRecommendations';

// ============================================================================
// TYPES
// ============================================================================

interface RecommendationRowProps {
    items: RecommendationItem[];
    source: 'personalized' | 'random' | 'none';
    isLoading: boolean;
    onItemClick: (item: RecommendationItem) => void;
    showTypeBadge?: boolean;
}

// Card sizing constraints (px)
const MIN_CARD_WIDTH = 65;
const MAX_CARD_WIDTH = 110;
const CARD_GAP = 8; // 0.5rem

// ============================================================================
// COMPONENT
// ============================================================================

const RecommendationRow: React.FC<RecommendationRowProps> = ({
    items,
    source,
    isLoading,
    onItemClick,
    showTypeBadge = false,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [cardWidth, setCardWidth] = useState(90);
    const [visibleCount, setVisibleCount] = useState(0);

    // Measure container and calculate perfect-fit card count + width
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const availableWidth = entry.contentRect.width;

            // Calculate how many cards fit at the ideal width
            // Formula: N cards + (N-1) gaps = available width
            // N * cardWidth + (N-1) * gap = available
            // Start with max card width, increase count until cards are within range
            let bestCount = Math.floor((availableWidth + CARD_GAP) / (MAX_CARD_WIDTH + CARD_GAP));
            bestCount = Math.max(bestCount, 1);

            // Calculate the actual card width for this count
            let actualWidth = (availableWidth - (bestCount - 1) * CARD_GAP) / bestCount;

            // If cards would be too small, reduce count
            while (actualWidth < MIN_CARD_WIDTH && bestCount > 1) {
                bestCount--;
                actualWidth = (availableWidth - (bestCount - 1) * CARD_GAP) / bestCount;
            }

            setVisibleCount(bestCount);
            setCardWidth(Math.floor(actualWidth));
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Don't render if no items and not loading
    if (!isLoading && items.length === 0) return null;

    const headerText = source === 'personalized' ? 'For You' : 'From Your Library';
    const HeaderIcon = source === 'personalized' ? Sparkles : Library;

    // Only show as many cards as fit perfectly
    const displayItems = items.slice(0, visibleCount);

    return (
        <div className="recommendation-row">
            <div className="recommendation-header">
                <HeaderIcon size={12} />
                <span>{isLoading ? 'Loading...' : headerText}</span>
            </div>

            <div className="recommendation-cards" ref={containerRef}>
                {isLoading ? (
                    // Skeleton placeholders
                    visibleCount > 0 ? (
                        Array.from({ length: visibleCount }).map((_, i) => (
                            <div
                                key={i}
                                className="recommendation-skeleton-card"
                                style={{ width: cardWidth, minWidth: cardWidth }}
                            />
                        ))
                    ) : (
                        // Before first measurement, show flex placeholders
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="recommendation-skeleton-card recommendation-skeleton-initial" />
                        ))
                    )
                ) : (
                    displayItems.map(item => (
                        <div
                            key={item.ratingKey}
                            className="recommendation-card"
                            style={{ width: cardWidth, minWidth: cardWidth }}
                            onClick={() => onItemClick(item)}
                            title={`${item.title}${item.year ? ` (${item.year})` : ''}`}
                        >
                            {item.thumb ? (
                                <img
                                    src={item.thumb}
                                    alt={item.title}
                                    className="recommendation-poster"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="recommendation-poster-placeholder">
                                    {item.mediaType === 'movie' ? (
                                        <Film size={18} />
                                    ) : (
                                        <Tv size={18} />
                                    )}
                                </div>
                            )}
                            {showTypeBadge && item.integrationType && (
                                <img
                                    src={`/api/icons/system/${item.integrationType}/file`}
                                    alt={item.integrationType}
                                    className="recommendation-type-badge"
                                />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RecommendationRow;

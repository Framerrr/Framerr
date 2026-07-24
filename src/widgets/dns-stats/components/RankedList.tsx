import React from 'react';

export interface RankedListItem {
    label: string;
    count: number;
    meta?: string | null;
}

interface RankedListProps {
    title?: string;
    items: RankedListItem[];
}

const RankedList: React.FC<RankedListProps> = ({ title, items }) => {
    if (items.length === 0) return null;

    return (
        <div className="dns-stats-ranked">
            {title ? (
                <h4 className="dns-stats-ranked-title text-theme-secondary">{title}</h4>
            ) : null}
            <ul className="dns-stats-ranked-list">
                {items.map((entry, index) => (
                    <li
                        key={`${entry.label}-${index}`}
                        className="dns-stats-ranked-row bg-theme-tertiary text-theme-primary"
                    >
                        <span className="dns-stats-ranked-label text-theme-primary">{entry.label}</span>
                        <span className="dns-stats-ranked-meta">
                            {entry.meta ? (
                                <span className="dns-stats-ranked-extra text-theme-secondary">{entry.meta}</span>
                            ) : null}
                            <span className="dns-stats-ranked-count bg-theme-secondary text-theme-secondary">
                                {entry.count.toLocaleString()}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default RankedList;

import React from 'react';

interface TopBlockedListProps {
    domains: Array<{ domain: string; count: number }>;
}

/** @deprecated Prefer RankedList — kept as thin wrapper for existing imports */
const TopBlockedList: React.FC<TopBlockedListProps> = ({ domains }) => {
    if (domains.length === 0) return null;

    return (
        <div className="dns-stats-ranked">
            <h4 className="dns-stats-ranked-title text-theme-secondary">Top Blocked</h4>
            <ul className="dns-stats-ranked-list">
                {domains.map((entry) => (
                    <li
                        key={entry.domain}
                        className="dns-stats-ranked-row bg-theme-tertiary text-theme-primary"
                    >
                        <span className="dns-stats-ranked-label text-theme-primary">{entry.domain}</span>
                        <span className="dns-stats-ranked-count bg-theme-secondary text-theme-secondary">
                            {entry.count.toLocaleString()}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default TopBlockedList;

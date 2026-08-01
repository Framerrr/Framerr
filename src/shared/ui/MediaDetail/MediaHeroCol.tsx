import React from 'react';
import './styles.css';

interface MediaHeroColProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Right-of-poster hero column.
 * Spreads children with a min/max gap; leftover free space stays at the bottom
 * so sparse heroes pack toward the top instead of huge mid gaps.
 */
export const MediaHeroCol: React.FC<MediaHeroColProps> = ({ children, className = '' }) => {
    const items = React.Children.toArray(children).filter(Boolean);

    return (
        <div className={`media-hero__col${className ? ` ${className}` : ''}`}>
            {items.map((child, index) => (
                <React.Fragment key={index}>
                    {index > 0 ? (
                        <div className="media-hero__col-spacer" aria-hidden="true" />
                    ) : null}
                    {child}
                </React.Fragment>
            ))}
        </div>
    );
};

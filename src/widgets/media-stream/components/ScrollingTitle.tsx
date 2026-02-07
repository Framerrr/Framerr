/**
 * ScrollingTitle Component
 * 
 * Displays a title that only scrolls when text overflows its container.
 * Uses marquee-style animation with ResizeObserver for responsive behavior.
 */

import React, { useState, useEffect, useRef } from 'react';

interface ScrollingTitleProps {
    title: string;
}

export const ScrollingTitle: React.FC<ScrollingTitleProps> = ({ title }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [shouldScroll, setShouldScroll] = useState(false);

    useEffect(() => {
        const checkOverflow = () => {
            if (containerRef.current && textRef.current) {
                // Text overflows if its width exceeds the container's width
                setShouldScroll(textRef.current.scrollWidth > containerRef.current.clientWidth);
            }
        };

        checkOverflow();
        // Re-check on resize
        const resizeObserver = new ResizeObserver(checkOverflow);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        return () => resizeObserver.disconnect();
    }, [title]);

    return (
        <div className="plex-card__title" title={title} ref={containerRef}>
            <span
                ref={textRef}
                className={`plex-card__title-text${shouldScroll ? ' plex-card__title-text--scrolling' : ''}`}
            >
                {shouldScroll ? (
                    <>{title}&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;{title}&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;</>
                ) : (
                    title
                )}
            </span>
        </div>
    );
};

export default ScrollingTitle;

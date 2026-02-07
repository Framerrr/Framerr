/**
 * CornerResizeIndicators Component
 * 
 * Visual L-bracket indicators for resize handles.
 * Purely visual - doesn't interact with resize logic.
 * 
 * Mobile: 3 corners (NW, SW, SE)
 * Desktop: 4 corners (NW, NE, SW, SE) + 4 sides (N, E, S, W)
 * 
 * Uses ResizeObserver for real-time height detection during resize.
 * Side handles hidden on h=1 widgets (height < 100px).
 */

import React, { useState, useEffect, useRef } from 'react';

interface CornerResizeIndicatorsProps {
    /** Whether to show the indicators (edit mode) */
    visible: boolean;
    /** Whether on mobile viewport */
    isMobile: boolean;
    /** Row height in pixels for grid unit calculation (default: 50) */
    rowHeight?: number;
}

// Threshold: h=1 widget is roughly 50px, h=2 is ~100px
// Show side handles when pixel height >= 100px (h >= 2)
const SIDE_HANDLE_THRESHOLD_PX = 100;

/**
 * SVG L-bracket component with rounded strokes for corners
 */
const LBracket: React.FC<{
    position: 'nw' | 'ne' | 'sw' | 'se';
}> = ({ position }) => {
    // Curved L-bracket paths with ~8px radius curve - shorter tails
    // SVG is 20x20, path draws an L with curved corner
    const paths: Record<string, string> = {
        nw: 'M2 13 L2 10 Q2 2 10 2 L13 2',     // Top-left: down→curve→right
        ne: 'M18 13 L18 10 Q18 2 10 2 L7 2',   // Top-right: down→curve→left
        sw: 'M2 7 L2 10 Q2 18 10 18 L13 18',   // Bottom-left: up→curve→right  
        se: 'M18 7 L18 10 Q18 18 10 18 L7 18', // Bottom-right: up→curve→left
    };

    // Position at corners - small offset to sit inside widget border
    const positionStyles: Record<string, React.CSSProperties> = {
        nw: { top: 4, left: 4 },
        ne: { top: 4, right: 4 },
        sw: { bottom: 4, left: 4 },
        se: { bottom: 4, right: 4 },
    };

    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            style={{
                position: 'absolute',
                ...positionStyles[position],
                pointerEvents: 'none',
                zIndex: 100,
            }}
        >
            <path
                d={paths[position]}
                stroke="var(--accent-edit)"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
            />
        </svg>
    );
};

/**
 * SVG straight line component for side handles (desktop only)
 * Roughly 3/4 the length of an L-bracket leg, with rounded ends
 */
const SideLine: React.FC<{
    position: 'n' | 'e' | 's' | 'w';
}> = ({ position }) => {
    // Line is ~24px long (slightly longer than L-bracket legs)
    const isVertical = position === 'e' || position === 'w';

    // SVG size: 28x8 for horizontal, 8x28 for vertical
    const width = isVertical ? 8 : 28;
    const height = isVertical ? 28 : 8;

    // Path: horizontal line or vertical line, centered
    const path = isVertical
        ? 'M4 2 L4 26'  // Vertical: top to bottom (24px)
        : 'M2 4 L26 4'; // Horizontal: left to right (24px)

    // Position at center of each edge
    const positionStyles: Record<string, React.CSSProperties> = {
        n: { top: 4, left: '50%', transform: 'translateX(-50%)' },
        s: { bottom: 4, left: '50%', transform: 'translateX(-50%)' },
        e: { right: 4, top: '50%', transform: 'translateY(-50%)' },
        w: { left: 4, top: '50%', transform: 'translateY(-50%)' },
    };

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{
                position: 'absolute',
                ...positionStyles[position],
                pointerEvents: 'none',
                zIndex: 100,
            }}
        >
            <path
                d={path}
                stroke="var(--accent-edit)"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
            />
        </svg>
    );
};

export const CornerResizeIndicators: React.FC<CornerResizeIndicatorsProps> = ({
    visible,
    isMobile,
}) => {
    // Track container height for real-time side handle visibility
    const [containerHeight, setContainerHeight] = useState<number>(0);
    const observerRef = useRef<ResizeObserver | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Set up ResizeObserver to track parent container height
    useEffect(() => {
        if (!visible) return;

        // Get parent element (the Card/widget container)
        const container = containerRef.current?.parentElement;
        if (!container) return;

        observerRef.current = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const height = entry.contentRect.height;
                setContainerHeight(height);
            }
        });

        observerRef.current.observe(container);

        // Get initial height
        setContainerHeight(container.getBoundingClientRect().height);

        return () => {
            observerRef.current?.disconnect();
        };
    }, [visible]);

    if (!visible) return null;

    // Show side handles when height >= threshold (h >= 2)
    const showSideHandles = containerHeight >= SIDE_HANDLE_THRESHOLD_PX;

    if (isMobile) {
        // Mobile: 3 corners only (NW, SW, SE)
        return (
            <div ref={containerRef} style={{ display: 'contents' }}>
                <LBracket position="nw" />
                <LBracket position="sw" />
                <LBracket position="se" />
            </div>
        );
    }

    // Desktop: 4 corners + 4 sides (sides hidden on h=1)
    return (
        <div ref={containerRef} style={{ display: 'contents' }}>
            {/* 4 corners */}
            <LBracket position="nw" />
            <LBracket position="ne" />
            <LBracket position="sw" />
            <LBracket position="se" />

            {/* 4 sides (all hidden on h=1 widgets) */}
            {showSideHandles && (
                <>
                    <SideLine position="n" />
                    <SideLine position="e" />
                    <SideLine position="s" />
                    <SideLine position="w" />
                </>
            )}
        </div>
    );
};

export default CornerResizeIndicators;


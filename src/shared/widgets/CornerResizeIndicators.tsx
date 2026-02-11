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
    // Curved L-bracket paths with ~16px radius curve — matches widget 1rem border-radius
    // SVG is 28x28, path draws an L with curved corner
    const paths: Record<string, string> = {
        nw: 'M2 18 L2 16 Q2 2 16 2 L18 2',     // Top-left: down→curve→right
        ne: 'M26 18 L26 16 Q26 2 12 2 L10 2',   // Top-right: down→curve→left
        sw: 'M2 10 L2 12 Q2 26 16 26 L18 26',   // Bottom-left: up→curve→right
        se: 'M26 10 L26 12 Q26 26 12 26 L10 26', // Bottom-right: up→curve→left
    };

    // Position at corners — inset to sit inside widget border
    const positionStyles: Record<string, React.CSSProperties> = {
        nw: { top: 0, left: 0 },
        ne: { top: 0, right: 0 },
        sw: { bottom: 0, left: 0 },
        se: { bottom: 0, right: 0 },
    };

    return (
        <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
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
    // Line is ~28px long (slightly longer than L-bracket legs)
    const isVertical = position === 'e' || position === 'w';

    // SVG size: 32x8 for horizontal, 8x32 for vertical
    const width = isVertical ? 8 : 32;
    const height = isVertical ? 32 : 8;

    // Path: horizontal line or vertical line, centered
    const path = isVertical
        ? 'M4 2 L4 30'  // Vertical: top to bottom (28px)
        : 'M2 4 L30 4'; // Horizontal: left to right (28px)

    // Position at center of each edge
    const positionStyles: Record<string, React.CSSProperties> = {
        n: { top: -3, left: '50%', transform: 'translateX(-50%)' },
        s: { bottom: -3, left: '50%', transform: 'translateX(-50%)' },
        e: { right: -3, top: '50%', transform: 'translateY(-50%)' },
        w: { left: -3, top: '50%', transform: 'translateY(-50%)' },
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


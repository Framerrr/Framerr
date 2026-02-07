/**
 * TemplateThumbnail - Elegant CSS Grid-based template preview
 * 
 * Renders a lightweight, accurate representation of the template layout
 * using CSS Grid positioning with widget icons from the registry.
 * 
 * Features:
 * - Accurate layout using same grid math as dashboard
 * - Theme-consistent styling (uses CSS variables)
 * - Widget icons (from plugin system)
 * - Subtle shadows for depth
 * - No GridStack overhead - pure CSS
 */

import React, { useMemo } from 'react';
import { getWidgetIcon } from '../../../widgets/registry';
import { GRID_COLS, ROW_HEIGHT, GRID_MARGIN } from '../../../constants/gridConfig';

interface TemplateWidget {
    type: string;
    layout: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    config?: Record<string, unknown>;
}

interface TemplateThumbnailProps {
    widgets: TemplateWidget[];
    width?: number;
    height?: number;
    className?: string;
}

// Widget card styling - matches Framerr's glass card design
// Uses theme CSS variables for consistency
const CARD_STYLE = {
    // Solid background matching widget cards
    bg: 'var(--bg-secondary)',
    border: 'var(--border-glass)',
    // Icon uses accent for subtle color pop
    icon: 'var(--text-secondary)',
};

const TemplateThumbnail: React.FC<TemplateThumbnailProps> = ({
    widgets,
    width = 80,
    height = 80,
    className = '',
}) => {
    // Calculate scale and grid dimensions
    // Padding on left/right for balanced look
    const horizontalPadding = 4;
    const contentWidth = width - (horizontalPadding * 2);

    const gridInfo = useMemo(() => {
        if (widgets.length === 0) return null;

        // Virtual grid width (what we're scaling from)
        const virtualWidth = 1200; // Standard desktop width

        // Scale to fit container WIDTH only (allow vertical overflow)
        // This creates a more zoomed-in, cropped look from top
        const scale = contentWidth / virtualWidth;

        return { virtualWidth, scale };
    }, [widgets, contentWidth]);

    if (widgets.length === 0 || !gridInfo) {
        return (
            <div
                className={`relative overflow-hidden rounded-lg ${className}`}
                style={{
                    width,
                    height,
                    background: 'var(--bg-tertiary)',
                }}
            >
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[8px] text-theme-tertiary opacity-50">Empty</span>
                </div>
            </div>
        );
    }

    const { scale, virtualWidth } = gridInfo;
    const colWidth = virtualWidth / GRID_COLS.lg;

    return (
        <div
            className={`relative overflow-hidden rounded-lg ${className}`}
            style={{
                width,
                height,
                background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
        >
            {/* Subtle grid pattern overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: `${4 * scale}px ${4 * scale}px`,
                }}
            />

            {/* Widget cards */}
            {widgets.map((widget, index) => {
                const Icon = getWidgetIcon(widget.type);

                // Calculate position using grid math
                const left = widget.layout.x * colWidth * scale + horizontalPadding;
                const top = widget.layout.y * (ROW_HEIGHT + GRID_MARGIN[1]) * scale + 4; // 4px top padding
                const w = widget.layout.w * colWidth * scale - (GRID_MARGIN[0] * scale);
                const h = widget.layout.h * (ROW_HEIGHT + GRID_MARGIN[1]) * scale - (GRID_MARGIN[1] * scale);

                // Calculate icon size based on cell size
                const iconSize = Math.min(Math.max(w * 0.4, 6), Math.max(h * 0.4, 6), 14);
                const showIcon = w >= 8 && h >= 8;

                return (
                    <div
                        key={`${widget.type}-${index}`}
                        className="absolute transition-all duration-200"
                        style={{
                            left: left + (GRID_MARGIN[0] * scale * 0.5),
                            top: top + (GRID_MARGIN[1] * scale * 0.5),
                            width: Math.max(w, 2),
                            height: Math.max(h, 2),
                            background: CARD_STYLE.bg,
                            border: `0.5px solid ${CARD_STYLE.border}`,
                            borderRadius: Math.max(2, 4 * scale),
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {showIcon && (
                            <Icon
                                size={iconSize}
                                style={{
                                    color: CARD_STYLE.icon,
                                    opacity: 0.7,
                                    flexShrink: 0,
                                }}
                            />
                        )}
                    </div>
                );
            })}

            {/* Elegant shine overlay */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)',
                    borderRadius: 'inherit',
                }}
            />
        </div>
    );
};

export default TemplateThumbnail;

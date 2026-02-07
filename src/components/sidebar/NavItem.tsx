import React from 'react';
import { motion } from 'framer-motion';
import { useSharedSidebar } from './SharedSidebarContext';
import { indicatorSpring } from './types';

interface NavItemProps {
    /** Unique identifier for this nav item */
    id: string;
    /** Whether this item is currently active (selected) */
    isActive: boolean;
    /** Whether this is the logout button (red styling) */
    isLogout?: boolean;
    /** Optional href for link items */
    href?: string;
    /** Click handler */
    onClick?: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
    /** Additional className */
    className?: string;
    /** Child content */
    children: React.ReactNode;
    /** Render as button instead of anchor */
    asButton?: boolean;
}

/**
 * NavItem component with animated hover indicator.
 * Uses Framer Motion's layoutId for smooth indicator transitions between items.
 * The indicator renders INSIDE each item and uses layoutId to animate position.
 */
export function NavItem({
    id,
    isActive,
    isLogout = false,
    href,
    onClick,
    className = '',
    children,
    asButton = false,
}: NavItemProps) {
    const { hoveredItem, handleMouseEnter, handleMouseLeave } = useSharedSidebar();

    const isHovered = hoveredItem === id;
    // Show indicator when:
    // 1. This item is hovered, OR
    // 2. This item is active AND nothing is hovered
    const showIndicator = isHovered || (!hoveredItem && isActive);

    // Determine indicator style
    const indicatorClass = isLogout
        ? 'bg-red-500/10'
        : isHovered
            ? 'bg-slate-800/60'
            : 'bg-accent/20 shadow-lg';

    const handleEnter = () => handleMouseEnter(id);

    const commonProps = {
        className: `relative ${className}`,
        onMouseEnter: handleEnter,
        onMouseLeave: handleMouseLeave,
    };

    const content = (
        <>
            {/* Indicator - rendered inside each item, uses layoutId for animation */}
            {showIndicator && (
                <motion.div
                    layoutId="desktopNavIndicator"
                    className={`absolute inset-y-1 inset-x-2 rounded-xl pointer-events-none ${indicatorClass}`}
                    initial={false}
                    transition={indicatorSpring}
                    style={{ zIndex: 0 }}
                />
            )}
            {/* Content - above indicator */}
            <div className="relative z-10 flex items-center w-full">
                {children}
            </div>
        </>
    );

    if (asButton) {
        return (
            <button
                {...commonProps}
                onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
            >
                {content}
            </button>
        );
    }

    return (
        <a
            {...commonProps}
            href={href}
            onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
        >
            {content}
        </a>
    );
}

export default NavItem;

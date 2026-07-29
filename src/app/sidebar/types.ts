// Sidebar shared types - extracted from Sidebar.tsx

import type { CSSProperties } from 'react';

export interface Tab {
    id: string;
    name: string;
    url: string;
    slug: string;
    icon?: string;
    groupId?: string;
    enabled?: boolean;
    openInNewTab?: boolean;
}

export interface Group {
    id: string | number;
    name: string;
}

export interface UserProfile {
    username?: string;
    profilePicture?: string;
}

export interface ExpandedGroups {
    [key: string]: boolean;
}

export interface TabsResponse {
    tabs?: Tab[];
}

// Indicator style state
export interface IndicatorStyle {
    isVisible: boolean;
    isLogout: boolean;
}

// Spring configurations for animations
export const sidebarSpring = {
    type: 'spring' as const,
    stiffness: 350,
    damping: 35,
};

/** Highlight pill vertical retargets + dashboard picker morph height (aside stays on sidebarSpring). */
export const highlightSpring = {
    type: 'spring' as const,
    stiffness: 550,
    damping: 45,
};

export const textSpring = {
    type: 'spring' as const,
    stiffness: 400,
    damping: 35,
};

// Fast spring for indicator
export const indicatorSpring = {
    type: 'spring' as const,
    stiffness: 500,
    damping: 35,
};

/** Sidebar label exit — fast tween; springs on opacity stall AnimatePresence mode="wait" remounts. */
export const labelExitTween = { duration: 0.1, ease: 'easeIn' as const };

/** Per-row enter stagger for the expand cascade (capped — rows past 5 animate together). */
export const labelStagger = (index: number): number => 0.015 * Math.min(index, 4);

/**
 * Highlight / dashboard-picker morph fill.
 * Must match `.bg-accent/20` in design-system.css (hardcoded blue, not theme --accent).
 * Solid --bg-secondary undercoat so the grown surface reads like the desktop indicator.
 */
export const indicatorSurfaceStyle: CSSProperties = {
    backgroundImage:
        'linear-gradient(rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.2)), linear-gradient(var(--bg-secondary), var(--bg-secondary))',
};

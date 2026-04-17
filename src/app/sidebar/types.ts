// Sidebar shared types - extracted from Sidebar.tsx

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

/**
 * Settings menu configuration for sidebar navigation
 * Mirrors the structure in UserSettings.tsx for consistency
 */

export interface SettingsSubTab {
    id: string;
    label: string;
    icon?: string;          // Lucide icon name for sub-tab
    adminOnly?: boolean;
}

export interface SidebarSettingsCategory {
    id: string;
    label: string;
    icon: string;           // Lucide icon name
    iconColor: string;      // iOS-style color key (blue, orange, purple, etc.)
    adminOnly?: boolean;
    children?: SettingsSubTab[];  // Sub-tabs for accordion expansion
}

/**
 * User settings categories - visible to all users
 */
export const userSettingsCategories: SidebarSettingsCategory[] = [
    { id: 'tabs', label: 'My Tabs', icon: 'Layout', iconColor: 'blue' },
    { id: 'tabgroups', label: 'Tab Groups', icon: 'FolderTree', iconColor: 'orange' },
    {
        id: 'integrations',
        label: 'Integrations',
        icon: 'Puzzle',
        iconColor: 'purple',
        children: [
            { id: 'services', label: 'Service Settings', icon: 'Wrench', adminOnly: true },
            { id: 'gallery', label: 'Widget Gallery', icon: 'Grid3x3' },
            { id: 'active', label: 'Active Widgets', icon: 'Layers' },
            { id: 'shared', label: 'Shared Widgets', icon: 'Share2', adminOnly: true },
            { id: 'linked', label: 'Linked Accounts', icon: 'Link' },
        ]
    },
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        iconColor: 'teal',
        children: [
            { id: 'general', label: 'General', icon: 'Sliders' },
            { id: 'templates', label: 'Templates', icon: 'Copy' },
        ]
    },
    {
        id: 'customization',
        label: 'Customization',
        icon: 'Settings',
        iconColor: 'gray',
        children: [
            { id: 'general', label: 'General', icon: 'SlidersHorizontal' },
            { id: 'colors', label: 'Colors', icon: 'Palette' },
            { id: 'favicon', label: 'Favicon', icon: 'Image', adminOnly: true },
        ]
    },
    { id: 'profile', label: 'Profile', icon: 'User', iconColor: 'blue' },
    { id: 'notifications', label: 'Notifications', icon: 'Bell', iconColor: 'red' },
];

/**
 * Admin-only settings categories
 */
export const adminSettingsCategories: SidebarSettingsCategory[] = [
    {
        id: 'users',
        label: 'User Management',
        icon: 'Users',
        iconColor: 'green',
        adminOnly: true,
        children: [
            { id: 'list', label: 'Users', icon: 'Users' },
            { id: 'groups', label: 'Groups', icon: 'FolderTree' },
        ]
    },
    {
        id: 'auth',
        label: 'Auth',
        icon: 'Shield',
        iconColor: 'indigo',
        adminOnly: true,
        children: [
            { id: 'proxy', label: 'Auth Proxy', icon: 'Network' },
            { id: 'plex', label: 'Plex SSO', icon: 'Tv2' },
            { id: 'iframe', label: 'iFrame Auth', icon: 'Frame' },
        ]
    },
    {
        id: 'advanced',
        label: 'Advanced',
        icon: 'Cpu',
        iconColor: 'gray',
        adminOnly: true,
        children: [
            { id: 'debug', label: 'Debug', icon: 'Bug' },
            { id: 'system', label: 'System', icon: 'Activity' },
            { id: 'backup', label: 'Backup', icon: 'Archive' },
            { id: 'jobs', label: 'Jobs & Cache', icon: 'Clock' },
            { id: 'experimental', label: 'Experimental', icon: 'Beaker' },
            // { id: 'developer', label: 'Developer', icon: 'Code' }, // TODO: Re-enable when docs/support content is ready
        ]
    },
];


/**
 * Get all settings categories based on admin access
 */
export function getSettingsCategories(hasAdminAccess: boolean): SidebarSettingsCategory[] {
    if (hasAdminAccess) {
        // Add admin items at the end
        return [...userSettingsCategories, ...adminSettingsCategories];
    }
    return userSettingsCategories;
}

/**
 * Get visible children for a category based on admin access
 */
export function getVisibleChildren(category: SidebarSettingsCategory, hasAdminAccess: boolean): SettingsSubTab[] {
    if (!category.children) return [];
    return category.children.filter(child => !child.adminOnly || hasAdminAccess);
}

/**
 * Get first visible child for a category (for auto-navigation)
 */
export function getFirstVisibleChild(category: SidebarSettingsCategory, hasAdminAccess: boolean): SettingsSubTab | undefined {
    const children = getVisibleChildren(category, hasAdminAccess);
    return children[0];
}

/**
 * Icon color mapping for iOS-style colored icons
 */
export const iconColorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    teal: 'bg-teal-500',
    gray: 'bg-gray-500',
    red: 'bg-red-500',
    green: 'bg-green-500',
    indigo: 'bg-indigo-500',
};

/**
 * Build a flat map of segment IDs to display labels.
 * Derives from the config so breadcrumbs stay in sync with sidebar.
 * 
 * @returns Record<segmentId, label>
 */
export function getSegmentLabels(): Record<string, string> {
    const labels: Record<string, string> = {};

    // Combine all categories (user + admin)
    const allCategories = [...userSettingsCategories, ...adminSettingsCategories];

    for (const category of allCategories) {
        // Add category label
        labels[category.id] = category.label;

        // Add children labels
        if (category.children) {
            for (const child of category.children) {
                labels[child.id] = child.label;
            }
        }
    }

    return labels;
}

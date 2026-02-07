/**
 * Tab Types
 * Shared between frontend (Sidebar, TabGroupsSettings) and backend (tabs routes)
 */

/**
 * Tab group for organizing tabs
 */
export interface TabGroup {
    id: number;
    name: string;
    order: number;
}

/**
 * Individual tab/link in the sidebar
 */
export interface SidebarTab {
    id: number;
    name: string;
    slug: string;
    url: string;
    icon?: string;
    groupId?: number | null;
    order: number;
    isActive?: boolean;
}

/**
 * Tab with group information included
 */
export interface TabWithGroup extends SidebarTab {
    group?: TabGroup | null;
}

/**
 * Data for creating a new tab
 */
export interface CreateTabData {
    name: string;
    slug?: string;
    url: string;
    icon?: string;
    groupId?: number | null;
    order?: number;
}

/**
 * Data for updating an existing tab
 */
export interface UpdateTabData {
    name?: string;
    slug?: string;
    url?: string;
    icon?: string;
    groupId?: number | null;
    order?: number;
}

/**
 * Data for creating a new tab group
 */
export interface CreateTabGroupData {
    name: string;
    order?: number;
}

/**
 * Data for updating a tab group
 */
export interface UpdateTabGroupData {
    name?: string;
    order?: number;
}

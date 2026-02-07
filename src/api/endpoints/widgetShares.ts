/**
 * Widget Shares API Endpoints
 * Admin widget sharing management
 */
import { api } from '../client';
import { UserId } from '../types';

// Types
export interface UserShareState {
    checked: boolean;
    integrations: string[];
}

export interface UserData {
    id: UserId;
    username: string;
    displayName?: string;
    profilePictureUrl?: string;
}

export interface GroupData {
    id: string;
    name: string;
    users: UserData[];
}

export interface UsersAndGroupsResponse {
    groups: GroupData[];
    ungroupedUsers: UserData[];
}

export interface ExistingSharesResponse {
    widgetShares: Array<{ shareType: string; shareTarget: string | null }>;
    userStates: Record<string, UserShareState>;
    hasEveryoneShare: boolean;
    groupShares: (string | null)[];
}

export interface MyAccessResponse {
    widgets: string[] | 'all';
    integrationTypes: string[] | 'all';
    integrations: string[] | 'all';  // Instance IDs user has access to
}

export interface SaveSharesData {
    userShares: string[];
    groupShares: string[];
    everyoneShare: boolean;
    integrationShares: Record<string, string[]>;
    compatibleTypes?: string[];  // P4 Pattern: Frontend passes types from plugin
}

// Response from admin/all endpoint
export interface WidgetShareSummary {
    shares: Array<{ shareType: string; shareTarget: string | null }>;
    userCount: number;
    groupCount: number;
    hasEveryoneShare: boolean;
}

export interface AllWidgetSharesResponse {
    widgetShares: Record<string, WidgetShareSummary>;
}

// Endpoints
export const widgetSharesApi = {
    /**
     * Get current user's widget/integration access
     * Used by non-admins to determine visible widgets
     */
    getMyAccess: () =>
        api.get<MyAccessResponse>('/api/widget-shares/my-access'),

    /**
     * Get users and groups for sharing modal (admin only)
     */
    getUsersAndGroups: () =>
        api.get<UsersAndGroupsResponse>('/api/widget-shares/admin/users-and-groups'),

    /**
     * Get existing shares for a widget type (admin only)
     * @param widgetType - The widget type
     * @param compatibleTypes - Integration types compatible with this widget (from plugin)
     */
    getExisting: (widgetType: string, compatibleTypes: string[] = []) =>
        api.get<ExistingSharesResponse>(`/api/widget-shares/admin/existing/${widgetType}?compatibleTypes=${compatibleTypes.join(',')}`),

    /**
     * Get all widget shares across all widget types (admin only)
     * Used by the Shared Widgets settings page
     */
    getAllShares: () =>
        api.get<AllWidgetSharesResponse>('/api/widget-shares/admin/all'),

    /**
     * Save shares for a widget type (admin only)
     */
    save: (widgetType: string, data: SaveSharesData) =>
        api.post<void>(`/api/widget-shares/${widgetType}`, data),

    /**
     * Revoke all shares for a specific widget type (admin only)
     */
    revokeWidget: (widgetType: string) =>
        api.delete<{ success: boolean; revoked: number }>(`/api/widget-shares/${widgetType}`),

    /**
     * Revoke ALL widget and integration shares globally (admin only)
     */
    revokeAll: () =>
        api.delete<{ success: boolean; revoked: number }>('/api/widget-shares/all'),
};

export default widgetSharesApi;

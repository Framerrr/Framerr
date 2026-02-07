/**
 * Tab Groups API Endpoints
 * Per-user tab groups management
 */
import { api } from '../client';
import { ApiResponse } from '../types';

// Types
export interface TabGroup {
    id: string;
    name: string;
    icon?: string | null;
    order?: number;
}

export interface CreateTabGroupData {
    name: string;
    icon?: string;
}

export interface UpdateTabGroupData {
    name?: string;
    icon?: string;
}

// Endpoints
export const tabGroupsApi = {
    /**
     * Get all tab groups for current user
     */
    getAll: () =>
        api.get<{ tabGroups: TabGroup[] }>('/api/tab-groups'),

    /**
     * Create new tab group
     */
    create: (data: CreateTabGroupData) =>
        api.post<{ tabGroup: TabGroup }>('/api/tab-groups', data),

    /**
     * Update tab group
     */
    update: (id: string, data: UpdateTabGroupData) =>
        api.put<{ tabGroup: TabGroup }>(`/api/tab-groups/${id}`, data),

    /**
     * Delete tab group
     */
    delete: (id: string) =>
        api.delete<ApiResponse<void>>(`/api/tab-groups/${id}`),

    /**
     * Reorder tab groups
     */
    reorder: (orderedIds: string[]) =>
        api.put<{ tabGroups: TabGroup[] }>('/api/tab-groups/reorder', { orderedIds }),

    /**
     * Batch update tab groups (replace all)
     * Used by existing frontend pattern that sends the full array
     */
    batchUpdate: (tabGroups: Array<{ id: string; name: string; order?: number }>) =>
        api.put<{ tabGroups: TabGroup[] }>('/api/tab-groups/batch', { tabGroups }),
};

export default tabGroupsApi;

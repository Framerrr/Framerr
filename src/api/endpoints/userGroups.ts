/**
 * User Groups API Endpoints
 * Group management for user organization
 */
import { api } from '../client';

// Types
export interface UserGroup {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    memberCount?: number;
}


// Endpoints
export const userGroupsApi = {
    /**
     * Get all user groups
     */
    getAll: () =>
        api.get<{ groups: UserGroup[] }>('/api/user-groups'),

    /**
     * Get single group by ID
     */
    getById: (id: string) =>
        api.get<{ group: UserGroup }>(`/api/user-groups/${id}`),

    /**
     * Create new group
     */
    create: (data: { name: string; description?: string }) =>
        api.post<{ group: UserGroup }>('/api/user-groups', data),

    /**
     * Update group
     */
    update: (id: string, data: { name?: string; description?: string }) =>
        api.put<{ group: UserGroup }>(`/api/user-groups/${id}`, data),

    /**
     * Delete group
     */
    delete: (id: string) =>
        api.delete<void>(`/api/user-groups/${id}`),
};

export default userGroupsApi;

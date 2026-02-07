/**
 * Users API Endpoints
 * User CRUD and management
 */
import { api } from '../client';
import { ApiResponse, UserId } from '../types';

// Types
export interface User {
    id: UserId;
    username: string;
    isAdmin: boolean;
    profilePictureUrl?: string;
    email?: string;
    createdAt?: string;
}

export interface CreateUserData {
    username: string;
    password: string;
    isAdmin?: boolean;
    email?: string;
}

export interface UpdateUserData {
    username?: string;
    password?: string;
    isAdmin?: boolean;
    email?: string;
    profilePictureUrl?: string;
}

// Endpoints
export const usersApi = {
    /**
     * Get all users (admin only - backend only has admin endpoint)
     */
    getAll: () =>
        api.get<{ users: User[] }>('/api/admin/users').then(res => res.users),

    /**
     * Get all users (admin endpoint with additional data)
     */
    getAllAdmin: () =>
        api.get<{ users: User[] }>('/api/admin/users'),

    /**
     * Get single user by ID
     */
    getById: (id: UserId) =>
        api.get<User>(`/api/users/${id}`),

    /**
     * Create new user (admin only)
     */
    create: (data: CreateUserData) =>
        api.post<{ user: User }>('/api/admin/users', data),

    /**
     * Update user (admin only)
     */
    update: (id: UserId, data: UpdateUserData) =>
        api.put<ApiResponse<User>>(`/api/admin/users/${id}`, data),

    /**
     * Delete user (admin only)
     */
    delete: (id: UserId) =>
        api.delete<ApiResponse<void>>(`/api/admin/users/${id}`),

    /**
     * Reset user password (admin only)
     */
    resetPassword: (id: UserId) =>
        api.post<{ tempPassword: string }>(`/api/admin/users/${id}/reset-password`),

    /**
     * Get user's group memberships
     */
    getUserGroups: (id: UserId) =>
        api.get<{ groups: { id: string }[] }>(`/api/admin/users/${id}/groups`),

    /**
     * Update user's group memberships
     */
    updateUserGroups: (id: UserId, groupIds: string[]) =>
        api.put<void>(`/api/admin/users/${id}/groups`, { groupIds }),
};

export default usersApi;

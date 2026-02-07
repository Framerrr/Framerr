/**
 * Profile API Endpoints
 * User profile management, password changes, profile picture
 */
import { api } from '../client';
import { ApiResponse } from '../types';

// Types
export interface ProfileData {
    username: string;
    email?: string;
    displayName?: string;
    profilePicture?: string;
}

export interface UpdateProfileData {
    displayName?: string;
}

export interface ChangePasswordData {
    currentPassword: string;
    newPassword: string;
}

export interface ProfilePictureResponse {
    profilePicture: string;
}

// Endpoints
export const profileApi = {
    /**
     * Get current user's profile
     */
    get: () =>
        api.get<ProfileData>('/api/profile'),

    /**
     * Update profile (display name, etc.)
     */
    update: (data: UpdateProfileData) =>
        api.put<ApiResponse<void>>('/api/profile', data),

    /**
     * Change password
     */
    changePassword: (data: ChangePasswordData) =>
        api.put<ApiResponse<void>>('/api/profile/password', data),

    /**
     * Upload profile picture
     */
    uploadPicture: (formData: FormData) =>
        api.post<ProfilePictureResponse>('/api/profile/picture', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),

    /**
     * Remove profile picture
     */
    removePicture: () =>
        api.delete<ApiResponse<void>>('/api/profile/picture'),
};

export default profileApi;

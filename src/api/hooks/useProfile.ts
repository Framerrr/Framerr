/**
 * Profile React Query Hooks
 * 
 * Hooks for user profile management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, ProfileData, UpdateProfileData, ChangePasswordData, ProfilePictureResponse } from '../endpoints/profile';
import { queryKeys } from '../queryKeys';

// ============================================================================
// PROFILE
// ============================================================================

/**
 * Fetch current user's profile
 */
export function useProfile() {
    return useQuery({
        queryKey: queryKeys.profile.me(),
        queryFn: () => profileApi.get(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Update profile (display name, etc.)
 */
export function useUpdateProfile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: UpdateProfileData) => profileApi.update(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
        },
    });
}

/**
 * Change password
 */
export function useChangePassword() {
    return useMutation({
        mutationFn: (data: ChangePasswordData) => profileApi.changePassword(data),
        // No invalidation needed - password change doesn't affect profile data
    });
}

/**
 * Upload profile picture
 */
export function useUploadProfilePicture() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (formData: FormData) => profileApi.uploadPicture(formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
        },
    });
}

/**
 * Remove profile picture
 */
export function useRemoveProfilePicture() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => profileApi.removePicture(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
        },
    });
}

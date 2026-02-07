/**
 * useProfileSettings Hook
 * 
 * Manages all state and business logic for the profile settings page.
 * Handles profile data loading, saving, password changes, and picture management.
 * 
 * P2 Migration: Uses React Query hooks for data fetching.
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { useProfile, useUpdateProfile, useChangePassword, useUploadProfilePicture, useRemoveProfilePicture } from '../../../api/hooks';
import imageCompression from 'browser-image-compression';
import logger from '../../../utils/logger';
import { useNotifications } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import {
    ProfileData,
    PasswordFormData,
    ProfileSettingsState,
    ProfileSettingsHandlers,
    COMPRESSION_SETTINGS,
} from '../types';

interface UseProfileSettingsReturn {
    state: ProfileSettingsState;
    handlers: ProfileSettingsHandlers;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useProfileSettings(): UseProfileSettingsReturn {
    const { error: showError, success: showSuccess } = useNotifications();
    const { checkAuth } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // React Query hooks
    const profileQuery = useProfile();
    const updateProfileMutation = useUpdateProfile();
    const changePasswordMutation = useChangePassword();
    const uploadPictureMutation = useUploadProfilePicture();
    const removePictureMutation = useRemoveProfilePicture();

    // Derive data from query
    const profileData = profileQuery.data;
    const username = profileData?.username ?? '';
    const email = profileData?.email ?? '';

    // Local state for editable fields
    const [displayName, setDisplayName] = useState<string>('');
    const [displayNameInitialized, setDisplayNameInitialized] = useState(false);

    // Sync display name from query on first load
    useMemo(() => {
        if (profileData && !displayNameInitialized) {
            setDisplayName(profileData.displayName || profileData.username || '');
            setDisplayNameInitialized(true);
        }
    }, [profileData, displayNameInitialized]);

    // Profile picture with cache-busting
    const profilePicture = useMemo(() => {
        const pic = profileData?.profilePicture;
        return pic ? `${pic}?t=${Date.now()}` : null;
    }, [profileData?.profilePicture]);

    // Password form state
    const [password, setPasswordState] = useState<PasswordFormData>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    // UI state
    const [passwordError, setPasswordError] = useState<string>('');
    const [passwordSuccess, setPasswordSuccess] = useState<boolean>(false);
    const [confirmRemovePicture, setConfirmRemovePicture] = useState<boolean>(false);

    // Derive loading states from mutations
    const loading = profileQuery.isLoading;
    const savingProfile = updateProfileMutation.isPending;
    const changingPassword = changePasswordMutation.isPending;
    const uploadingPicture = uploadPictureMutation.isPending;

    // Handler: Update password form field
    const setPassword = (field: keyof PasswordFormData, value: string): void => {
        setPasswordState(prev => ({ ...prev, [field]: value }));
    };

    // Handler: Save profile (display name)
    const handleSaveProfile = useCallback(async (): Promise<void> => {
        try {
            await updateProfileMutation.mutateAsync({ displayName });

            // Refresh auth context to update dashboard greeting
            await checkAuth();

            showSuccess('Profile Saved', 'Display name saved');
        } catch (error) {
            logger.error('Failed to save profile:', error);
            const err = error as Error & { response?: { data?: { error?: string } } };
            showError('Save Failed', err.response?.data?.error || 'Failed to save profile');
        }
    }, [displayName, updateProfileMutation, checkAuth, showSuccess, showError]);

    // Handler: Change password
    const handleChangePassword = useCallback(async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess(false);

        // Validation
        if (password.newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters');
            return;
        }

        if (password.newPassword !== password.confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        try {
            await changePasswordMutation.mutateAsync({
                currentPassword: password.currentPassword,
                newPassword: password.newPassword
            });

            setPasswordSuccess(true);
            setPasswordState({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
            showSuccess('Password Changed', 'Password updated');
        } catch (error) {
            const err = error as Error & { response?: { data?: { error?: string } } };
            setPasswordError(err.response?.data?.error || 'Failed to change password');
        }
    }, [password, changePasswordMutation, showSuccess]);

    // Handler: Upload profile picture
    const handleProfilePictureUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Allow larger files since we'll compress them (max 20MB raw)
        if (file.size > 20 * 1024 * 1024) {
            showError('File Too Large', 'File size must be less than 20MB');
            return;
        }

        try {
            // Compress image client-side before uploading
            logger.debug('Compressing profile picture', {
                originalSize: `${(file.size / 1024).toFixed(1)}KB`,
                type: file.type
            });

            const compressedFile = await imageCompression(file, COMPRESSION_SETTINGS);

            logger.debug('Compression complete', {
                compressedSize: `${(compressedFile.size / 1024).toFixed(1)}KB`,
                reduction: `${((1 - compressedFile.size / file.size) * 100).toFixed(0)}%`
            });

            const formData = new FormData();
            formData.append('profilePicture', compressedFile, file.name);

            const response = await uploadPictureMutation.mutateAsync(formData);

            // Dispatch event to notify Sidebar
            const pictureUrl = `${response.profilePicture}?t=${Date.now()}`;
            window.dispatchEvent(new CustomEvent('profilePictureUpdated', {
                detail: { profilePicture: pictureUrl }
            }));
            showSuccess('Photo Updated', 'Profile picture uploaded successfully');
        } catch (error) {
            logger.error('Failed to upload profile picture:', error);
            const err = error as Error & { response?: { data?: { error?: string } } };
            showError('Upload Failed', err.response?.data?.error || 'Failed to upload profile picture');
        }
    }, [uploadPictureMutation, showError, showSuccess]);

    // Handler: Remove profile picture
    const handleRemoveProfilePicture = useCallback(async (): Promise<void> => {
        try {
            await removePictureMutation.mutateAsync();
            setConfirmRemovePicture(false);

            // Dispatch event to notify Sidebar
            window.dispatchEvent(new CustomEvent('profilePictureUpdated', {
                detail: { profilePicture: null }
            }));
            showSuccess('Photo Removed', 'Profile picture removed');
        } catch (error) {
            logger.error('Failed to remove profile picture:', error);
            showError('Remove Failed', 'Failed to remove profile picture');
            setConfirmRemovePicture(false);
        }
    }, [removePictureMutation, showSuccess, showError]);

    return {
        state: {
            username,
            email,
            displayName,
            profilePicture,
            password,
            loading,
            savingProfile,
            changingPassword,
            uploadingPicture,
            passwordError,
            passwordSuccess,
            confirmRemovePicture,
        },
        handlers: {
            setDisplayName,
            setPassword,
            setConfirmRemovePicture,
            handleSaveProfile,
            handleChangePassword,
            handleProfilePictureUpload,
            handleRemoveProfilePicture,
        },
        fileInputRef,
    };
}

/**
 * Profile Feature Types
 * 
 * Contains all types for user profile management including
 * profile data, form data, and configuration constants.
 */

// ============================================
// COMPRESSION SETTINGS - Image upload config
// ============================================
export const COMPRESSION_SETTINGS = {
    maxSizeMB: 0.1,          // Target file size: 100KB (0.1MB)
    maxWidthOrHeight: 512,   // Max dimensions: 512x512
    useWebWorker: true,      // Use web worker for performance
    initialQuality: 0.8,     // Initial quality: 80%
};

// ============================================
// Data Types
// ============================================

/**
 * Profile data from the API
 */
export interface ProfileData {
    username: string;
    email: string;
    displayName: string;
    profilePicture: string | null;
}

/**
 * Password change form data
 */
export interface PasswordFormData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

/**
 * Profile settings state
 */
export interface ProfileSettingsState {
    // Profile data
    username: string;
    email: string;
    displayName: string;
    profilePicture: string | null;

    // Password form
    password: PasswordFormData;

    // UI state
    loading: boolean;
    savingProfile: boolean;
    changingPassword: boolean;
    uploadingPicture: boolean;
    passwordError: string;
    passwordSuccess: boolean;
    confirmRemovePicture: boolean;
}

/**
 * Profile settings handlers
 */
export interface ProfileSettingsHandlers {
    setDisplayName: (value: string) => void;
    setPassword: (field: keyof PasswordFormData, value: string) => void;
    setConfirmRemovePicture: (value: boolean) => void;
    handleSaveProfile: () => Promise<void>;
    handleChangePassword: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
    handleProfilePictureUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleRemoveProfilePicture: () => Promise<void>;
}

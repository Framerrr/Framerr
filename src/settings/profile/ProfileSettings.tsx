/**
 * ProfileSettings
 * 
 * Thin orchestrator component for profile settings page.
 * Composes sections and delegates logic to useProfileSettings hook.
 */

import React from 'react';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { SettingsPage } from '../../shared/ui/settings';
import { useProfileSettings } from './hooks/useProfileSettings';
import { PictureSection } from './sections/PictureSection';
import { InfoSection } from './sections/InfoSection';
import { PasswordSection } from './sections/PasswordSection';

const ProfileSettings: React.FC = () => {
    const { state, handlers, fileInputRef } = useProfileSettings();

    if (state.loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="lg" message="Loading profile..." />
            </div>
        );
    }

    return (
        <SettingsPage
            title="Profile"
            description="Manage your account and personal information"
        >
            {/* Profile Picture */}
            <PictureSection
                profilePicture={state.profilePicture}
                uploadingPicture={state.uploadingPicture}
                fileInputRef={fileInputRef}
                onUpload={handlers.handleProfilePictureUpload}
                onRemove={handlers.handleRemoveProfilePicture}
            />

            {/* User Information */}
            <InfoSection
                username={state.username}
                email={state.email}
                displayName={state.displayName}
                savingProfile={state.savingProfile}
                onDisplayNameChange={handlers.setDisplayName}
                onSave={handlers.handleSaveProfile}
            />

            {/* Change Password */}
            <PasswordSection
                password={state.password}
                changingPassword={state.changingPassword}
                passwordError={state.passwordError}
                passwordSuccess={state.passwordSuccess}
                onPasswordChange={handlers.setPassword}
                onSubmit={handlers.handleChangePassword}
            />
        </SettingsPage>
    );
};

export default ProfileSettings;

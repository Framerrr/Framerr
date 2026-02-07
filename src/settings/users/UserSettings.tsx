/**
 * User Settings
 * 
 * Thin orchestrator for user management (admin-only).
 * Routes to UserTable (list) or UserGroupsSection based on activeSubTab.
 */

import React from 'react';
import { Users as UsersIcon, Plus } from 'lucide-react';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Button } from '../../shared/ui';
import { useUserSettings } from './hooks/useUserSettings';
import { UserTable } from './components/UserTable';
import { UserFormModal } from './components/UserFormModal';
import { UserGroupsSection } from './components/UserGroupsSection';
import { SettingsPage, SettingsSection } from '../../shared/ui/settings';

interface UserSettingsProps {
    activeSubTab?: string | null;
}

export const UserSettings: React.FC<UserSettingsProps> = ({ activeSubTab }) => {
    const {
        users,
        groups,
        loading,
        showModal,
        modalMode,
        formData,
        confirmResetId,
        tempPassword,
        setConfirmResetId,
        isAdminGroup,
        handleCreateUser,
        handleEditUser,
        handleSubmit,
        handleDeleteUser,
        handleResetPassword,
        closeModal,
        updateFormField,
        copyTempPassword,
        dismissTempPassword,
    } = useUserSettings();

    // Route to groups section
    if (activeSubTab === 'groups') {
        return <UserGroupsSection />;
    }

    // Default: User list
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="lg" message="Loading users..." />
            </div>
        );
    }

    return (
        <SettingsPage
            title="Users"
            description="Manage user accounts and permissions"
        >
            <SettingsSection
                title="User List"
                icon={UsersIcon}
                headerRight={
                    <Button onClick={handleCreateUser} icon={Plus} size="md" textSize="sm">
                        <span className="hidden sm:inline">Add User</span>
                    </Button>
                }
            >
                <UserTable
                    users={users}
                    tempPassword={tempPassword}
                    confirmResetId={confirmResetId}
                    isAdminGroup={isAdminGroup}
                    onEditUser={handleEditUser}
                    onDeleteUser={handleDeleteUser}
                    onResetPassword={handleResetPassword}
                    onCopyTempPassword={copyTempPassword}
                    onDismissTempPassword={dismissTempPassword}
                    setConfirmResetId={setConfirmResetId}
                />
            </SettingsSection>

            {/* Create/Edit Modal */}
            <UserFormModal
                isOpen={showModal}
                mode={modalMode}
                formData={formData}
                groups={groups}
                onClose={closeModal}
                onSubmit={handleSubmit}
                onUpdateField={updateFormField}
            />
        </SettingsPage>
    );
};

export default UserSettings;

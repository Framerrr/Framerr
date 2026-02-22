/**
 * User Settings Hook
 * 
 * Manages all state and handlers for user management.
 */

import { useState, useCallback, FormEvent } from 'react';
import logger from '../../../utils/logger';
import { useNotifications } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import { usersApi, extractErrorMessage } from '../../../api';
import { useUsers, useUserGroupsList } from '../../../api/hooks';
import type { User, UserFormData, TempPassword, ModalMode } from '../types';

const INITIAL_FORM_DATA: UserFormData = {
    username: '',
    email: '',
    password: '',
    group: 'user',
    groupIds: []
};

export function useUserSettings() {
    // React Query hooks for data fetching
    const usersQuery = useUsers();
    const groupsQuery = useUserGroupsList();

    // Derive data from queries
    const users = (usersQuery.data ?? []) as unknown as User[];
    const groups = groupsQuery.data?.groups ?? [];
    const loading = usersQuery.isLoading;

    // Refetch functions
    const fetchUsers = useCallback(() => {
        usersQuery.refetch();
    }, [usersQuery]);

    const fetchGroups = useCallback(() => {
        groupsQuery.refetch();
    }, [groupsQuery]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<ModalMode>('create');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<UserFormData>(INITIAL_FORM_DATA);

    // Inline confirmation state (only for reset password)
    const [confirmResetId, setConfirmResetId] = useState<string | null>(null);

    // Temp password display
    const [tempPassword, setTempPassword] = useState<TempPassword | null>(null);

    // Self-demotion confirmation
    const [showSelfDemoteConfirm, setShowSelfDemoteConfirm] = useState(false);
    const [pendingSelfDemoteData, setPendingSelfDemoteData] = useState<{ body: Record<string, unknown>; groupIds: string[] } | null>(null);

    // Context
    const { error: showError, success: showSuccess } = useNotifications();
    const { user: currentUser, logout } = useAuth();

    // Check if group is admin
    const isAdminGroup = useCallback((group: string | undefined): boolean => {
        return group === 'admin';
    }, []);

    // Open create modal
    const handleCreateUser = useCallback(() => {
        fetchGroups(); // Refresh groups in case new ones were created
        setModalMode('create');
        setFormData(INITIAL_FORM_DATA);
        setSelectedUser(null);
        setShowModal(true);
    }, [fetchGroups]);

    // Open edit modal - groupIds are pre-fetched from the user list
    const handleEditUser = useCallback((user: User) => {
        fetchGroups(); // Refresh groups in case new ones were created
        setModalMode('edit');
        setSelectedUser(user);
        setFormData({
            username: user.username,
            email: user.email || '',
            password: '',
            group: user.group || 'user',
            groupIds: user.groupIds || []
        });
        setShowModal(true);
    }, [fetchGroups]);

    // Close modal
    const closeModal = useCallback(() => {
        setShowModal(false);
    }, []);

    // Submit create/edit
    const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        try {
            // Exclude groupIds from user save body (handled separately)
            const { groupIds, ...userData } = formData;
            const body = modalMode === 'create'
                ? userData
                : { ...userData, password: userData.password || undefined };

            // Intercept self-demotion: show confirmation dialog instead of saving
            // But only if there are other admins — if last admin, let backend reject with error
            const adminCount = users.filter(u => u.group === 'admin').length;
            if (
                modalMode === 'edit' &&
                selectedUser?.id === currentUser?.id &&
                formData.group !== currentUser?.group &&
                formData.group !== 'admin' &&
                adminCount > 1
            ) {
                setPendingSelfDemoteData({ body: body as Record<string, unknown>, groupIds });
                setShowSelfDemoteConfirm(true);
                return;
            }

            let savedUserId: string;
            if (modalMode === 'create') {
                const response = await usersApi.create(body as Parameters<typeof usersApi.create>[0]);
                savedUserId = response.user.id;
            } else {
                await usersApi.update(selectedUser!.id, body);
                savedUserId = selectedUser!.id;
            }

            // Save group memberships
            await usersApi.updateUserGroups(savedUserId, groupIds);

            setShowModal(false);
            fetchUsers();
            showSuccess(
                modalMode === 'create' ? 'User Created' : 'User Updated',
                modalMode === 'create'
                    ? `User "${formData.username}" created successfully`
                    : `User "${formData.username}" updated successfully`
            );
        } catch (error) {
            logger.error('Error saving user:', error);
            showError('Save Failed', extractErrorMessage(error));
        }
    }, [modalMode, selectedUser, formData, currentUser, fetchUsers, showSuccess, showError]);

    // Confirm self-demotion: save + logout
    const confirmSelfDemotion = useCallback(async () => {
        if (!pendingSelfDemoteData || !selectedUser) return;

        try {
            // Save groups first (while still admin), then role change, then logout
            await usersApi.updateUserGroups(selectedUser.id, pendingSelfDemoteData.groupIds);
            await usersApi.update(selectedUser.id, pendingSelfDemoteData.body);
            // Server revokes all sessions on role change — just redirect to login
            logout();
        } catch (error) {
            logger.error('Error self-demoting:', error);
            showError('Save Failed', extractErrorMessage(error));
            setShowSelfDemoteConfirm(false);
        }
    }, [pendingSelfDemoteData, selectedUser, showError, logout]);

    // Delete user
    const handleDeleteUser = useCallback(async (userId: string, username: string) => {
        try {
            await usersApi.delete(userId);
            fetchUsers();
            showSuccess('User Deleted', `User "${username}" deleted`);
        } catch (error) {
            logger.error('Error deleting user:', error);
            showError('Delete Failed', extractErrorMessage(error));
        }
    }, [fetchUsers, showSuccess, showError]);

    // Reset password
    const handleResetPassword = useCallback(async (userId: string, username: string) => {
        try {
            const response = await usersApi.resetPassword(userId);
            setTempPassword({ userId, password: response.tempPassword });
            setConfirmResetId(null);
            showSuccess('Password Reset', `New temporary password generated for ${username}`);
        } catch (error) {
            logger.error('Error resetting password:', error);
            showError('Reset Failed', extractErrorMessage(error));
            setConfirmResetId(null);
        }
    }, [showSuccess, showError]);

    // Copy temp password to clipboard
    const copyTempPassword = useCallback(() => {
        if (tempPassword) {
            navigator.clipboard.writeText(tempPassword.password);
            showSuccess('Copied', 'Password copied to clipboard');
        }
    }, [tempPassword, showSuccess]);

    // Dismiss temp password
    const dismissTempPassword = useCallback(() => {
        setTempPassword(null);
    }, []);

    // Update form field
    const updateFormField = useCallback(<K extends keyof UserFormData>(
        field: K,
        value: UserFormData[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    return {
        // Data
        users,
        groups,
        loading,
        currentUser,

        // Modal state
        showModal,
        modalMode,
        formData,

        // Confirmation state
        confirmResetId,
        tempPassword,
        showSelfDemoteConfirm,

        // Setters for inline confirmations
        setConfirmResetId,
        setShowSelfDemoteConfirm,

        // Handlers
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
        confirmSelfDemotion,
    };
}

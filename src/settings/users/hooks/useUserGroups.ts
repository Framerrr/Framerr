/**
 * useUserGroups Hook
 * 
 * State management for user groups (custom sharing categories).
 * Admin-only functionality for group CRUD and membership.
 * 
 * P2 Migration: Thin Orchestrator pattern
 * - Server state: Delegated to React Query hooks from useSettings.ts
 * - Local state: Modal, form data, selected group
 */

import { useState, useCallback } from 'react';
import {
    useUserGroupsList,
    useCreateUserGroup,
    useUpdateUserGroup,
    useDeleteUserGroup,
} from '../../../api/hooks/useSettings';
import type { UserGroup } from '../../../api/endpoints/userGroups';

// ============================================================================
// Types
// ============================================================================

export interface GroupMember {
    id: string;
    username: string;
    displayName: string;
    group: string;  // Permission group (admin/user)
}

export interface GroupFormData {
    name: string;
}

// Re-export for consumers
export type { UserGroup };

// ============================================================================
// Hook Implementation
// ============================================================================

export function useUserGroups() {
    // ========================================================================
    // Server State (React Query)
    // ========================================================================
    const {
        data: groupsResponse,
        isLoading: loading,
        error: queryError,
        refetch: fetchGroups,
    } = useUserGroupsList();

    // Unwrap groups from response
    const groups = groupsResponse?.groups ?? [];

    const createMutation = useCreateUserGroup();
    const updateMutation = useUpdateUserGroup();
    const deleteMutation = useDeleteUserGroup();

    // Derive error from query or mutations
    const error = queryError?.message
        || createMutation.error?.message
        || updateMutation.error?.message
        || deleteMutation.error?.message
        || null;

    // Derive submitting state from mutations
    const submitting = createMutation.isPending
        || updateMutation.isPending
        || deleteMutation.isPending;

    // ========================================================================
    // Local UI State
    // ========================================================================
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
    const [formData, setFormData] = useState<GroupFormData>({ name: '' });

    // ========================================================================
    // Operations (wrap mutations)
    // ========================================================================

    const createGroup = useCallback(async (name: string): Promise<UserGroup | null> => {
        try {
            const result = await createMutation.mutateAsync({ name });
            return result.group;
        } catch {
            return null;
        }
    }, [createMutation]);

    const updateGroup = useCallback(async (id: string, name: string): Promise<UserGroup | null> => {
        try {
            const result = await updateMutation.mutateAsync({ id, data: { name } });
            return result.group;
        } catch {
            return null;
        }
    }, [updateMutation]);

    const deleteGroup = useCallback(async (id: string): Promise<boolean> => {
        try {
            await deleteMutation.mutateAsync(id);
            return true;
        } catch {
            return false;
        }
    }, [deleteMutation]);

    // ========================================================================
    // Modal Handlers
    // ========================================================================

    const handleCreate = useCallback(() => {
        setModalMode('create');
        setSelectedGroup(null);
        setFormData({ name: '' });
        setShowModal(true);
    }, []);

    const handleEdit = useCallback((group: UserGroup) => {
        setModalMode('edit');
        setSelectedGroup(group);
        setFormData({ name: group.name });
        setShowModal(true);
    }, []);

    const handleSubmit = useCallback(async () => {
        const name = formData.name.trim();
        if (!name) return;

        if (modalMode === 'create') {
            const result = await createGroup(name);
            if (result) {
                setShowModal(false);
            }
        } else if (selectedGroup) {
            const result = await updateGroup(selectedGroup.id, name);
            if (result) {
                setShowModal(false);
            }
        }
    }, [modalMode, formData, selectedGroup, createGroup, updateGroup]);

    const closeModal = useCallback(() => {
        setShowModal(false);
        // Reset mutation errors when closing
        createMutation.reset();
        updateMutation.reset();
    }, [createMutation, updateMutation]);

    // ========================================================================
    // Return
    // ========================================================================

    return {
        // Data (from React Query)
        groups,
        loading,
        error,

        // Modal state (local)
        showModal,
        modalMode,
        selectedGroup,
        formData,
        submitting,

        // Data operations (wrap mutations)
        fetchGroups,
        createGroup,
        updateGroup,
        deleteGroup,

        // Modal handlers
        handleCreate,
        handleEdit,
        handleSubmit,
        closeModal,
        setFormData,
        setShowModal
    };
}

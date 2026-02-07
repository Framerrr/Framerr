/**
 * Custom hook for permission settings state and handlers
 * 
 * Uses React Query for server state (groups, defaultGroup)
 * Manages local UI state (modal, form) directly
 */
import { useState, FormEvent } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { PermissionGroup, PermissionFormData, PROTECTED_GROUPS } from '../types';
import {
    usePermissionGroups,
    useUpdatePermissionGroups,
    useUpdateDefaultGroup,
    PermissionGroup as ApiPermissionGroup
} from '../../../api/hooks/useSettings';
import logger from '../../../utils/logger';

interface UsePermissionSettingsReturn {
    // State
    groups: PermissionGroup[];
    defaultGroup: string;
    loading: boolean;
    showModal: boolean;
    modalMode: 'create' | 'edit';
    selectedGroup: PermissionGroup | null;
    formData: PermissionFormData;

    // Actions
    setShowModal: (show: boolean) => void;
    setFormData: React.Dispatch<React.SetStateAction<PermissionFormData>>;
    handleCreate: () => void;
    handleEdit: (group: PermissionGroup) => void;
    handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
    handleDelete: (group: PermissionGroup) => Promise<void>;
    handleDefaultGroupChange: (newDefaultGroup: string) => Promise<void>;
    togglePermission: (permissionId: string) => void;
    generateGroupId: (name: string) => string;
}

export function usePermissionSettings(): UsePermissionSettingsReturn {
    // React Query hooks for server state
    const { data, isLoading } = usePermissionGroups();
    const updateGroupsMutation = useUpdatePermissionGroups();
    const updateDefaultMutation = useUpdateDefaultGroup();

    // Derived server state
    const groups = (data?.groups ?? []) as PermissionGroup[];
    const defaultGroup = data?.defaultGroup ?? 'user';
    const loading = isLoading;

    // Local UI state
    const [showModal, setShowModal] = useState<boolean>(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [selectedGroup, setSelectedGroup] = useState<PermissionGroup | null>(null);
    const { error: showError, warning: showWarning, success: showSuccess } = useNotifications();

    const [formData, setFormData] = useState<PermissionFormData>({
        id: '',
        name: '',
        permissions: ['view_dashboard']
    });

    const generateGroupId = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const handleCreate = (): void => {
        setModalMode('create');
        setFormData({ id: '', name: '', permissions: ['view_dashboard'] });
        setSelectedGroup(null);
        setShowModal(true);
    };

    const handleEdit = (group: PermissionGroup): void => {
        setModalMode('edit');
        setFormData({ id: group.id, name: group.name, permissions: [...group.permissions] });
        setSelectedGroup(group);
        setShowModal(true);
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        if (!formData.name.trim()) {
            showWarning('Missing Name', 'Group name is required');
            return;
        }

        const groupId = modalMode === 'create' ? generateGroupId(formData.name) : formData.id;

        if (modalMode === 'create' && groups.some(g => g.id === groupId)) {
            showWarning('Duplicate Group', `A group with ID "${groupId}" already exists.`);
            return;
        }

        const newGroup: PermissionGroup = { id: groupId, name: formData.name, permissions: formData.permissions };

        try {
            const updatedGroupsArray = modalMode === 'create'
                ? [...groups, newGroup]
                : groups.map(g => g.id === groupId ? newGroup : g);

            await updateGroupsMutation.mutateAsync(updatedGroupsArray as ApiPermissionGroup[]);
            setShowModal(false);
            showSuccess(
                modalMode === 'create' ? 'Group Created' : 'Group Updated',
                `Permission group "${formData.name}" ${modalMode === 'create' ? 'created' : 'updated'} successfully`
            );
        } catch (error) {
            const err = error as Error & { response?: { data?: { error?: string } } };
            logger.error('Error saving group:', error);
            showError('Save Failed', err.response?.data?.error || 'Failed to save group');
        }
    };

    const handleDelete = async (group: PermissionGroup): Promise<void> => {
        if (PROTECTED_GROUPS.includes(group.id)) {
            showWarning('Cannot Delete', `Cannot delete system group "${group.name}".`);
            return;
        }

        if (group.id === defaultGroup) {
            showWarning('Cannot Delete', `Cannot delete "${group.name}" as it's the default group.`);
            return;
        }

        try {
            const updatedGroupsArray = groups.filter(g => g.id !== group.id);
            await updateGroupsMutation.mutateAsync(updatedGroupsArray as ApiPermissionGroup[]);
            showSuccess('Group Deleted', `Group "${group.name}" deleted`);
        } catch (error) {
            logger.error('Error deleting group:', error);
            showError('Delete Failed', 'Failed to delete group');
        }
    };

    const handleDefaultGroupChange = async (newDefaultGroup: string): Promise<void> => {
        try {
            await updateDefaultMutation.mutateAsync(newDefaultGroup);
            showSuccess('Default Updated', 'Default permission group updated');
        } catch (error) {
            showError('Update Failed', 'Failed to update default group');
        }
    };

    const togglePermission = (permissionId: string): void => {
        setFormData(prev => {
            const current = prev.permissions;

            if (permissionId === '*') {
                return { ...prev, permissions: current.includes('*') ? ['view_dashboard'] : ['*'] };
            }

            if (current.includes('*')) return prev;

            return {
                ...prev, permissions: current.includes(permissionId)
                    ? current.filter(p => p !== permissionId)
                    : [...current, permissionId]
            };
        });
    };

    return {
        // State
        groups,
        defaultGroup,
        loading,
        showModal,
        modalMode,
        selectedGroup,
        formData,

        // Actions
        setShowModal,
        setFormData,
        handleCreate,
        handleEdit,
        handleSubmit,
        handleDelete,
        handleDefaultGroupChange,
        togglePermission,
        generateGroupId
    };
}

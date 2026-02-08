/**
 * Group Settings Hook
 * 
 * Manages all state and business logic for the tab groups settings section.
 * Handles CRUD operations, drag-and-drop reordering, and form state.
 * 
 * Uses React Query for server state (via useTabGroupsList, useUpdateTabGroups).
 * Local state is used for UI-only concerns (modal, form data).
 */

import { useState, useCallback, FormEvent } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { DragEndEvent } from '@dnd-kit/core';
import { useNotifications } from '../../../context/NotificationContext';
import { useTabGroupsList, useUpdateTabGroups, TabGroup } from '../../../api/hooks/useSettings';
import type { TabGroupFormData, ModalMode } from '../types';

/** Default form values for creating a new group */
const DEFAULT_FORM_DATA: TabGroupFormData = {
    id: '',
    name: '',
    order: 0,
};

export interface UseGroupSettingsReturn {
    // Data
    tabGroups: TabGroup[];
    loading: boolean;

    // Modal state
    showModal: boolean;
    setShowModal: (show: boolean) => void;
    modalMode: ModalMode;
    selectedGroup: TabGroup | null;

    // Form state
    formData: TabGroupFormData;
    setFormData: React.Dispatch<React.SetStateAction<TabGroupFormData>>;

    // Actions
    handleCreate: () => void;
    handleEdit: (group: TabGroup) => void;
    handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
    handleDelete: (group: TabGroup) => Promise<void>;
    handleDragEnd: (event: DragEndEvent) => Promise<void>;

    // Utilities
    generateGroupId: (name: string) => string;
}

export function useGroupSettings(): UseGroupSettingsReturn {
    // React Query hooks for server state
    const { data: tabGroups = [], isPending: loading } = useTabGroupsList();
    const updateTabGroups = useUpdateTabGroups();

    // Modal state (UI-only)
    const [showModal, setShowModal] = useState<boolean>(false);
    const [modalMode, setModalMode] = useState<ModalMode>('create');
    const [selectedGroup, setSelectedGroup] = useState<TabGroup | null>(null);

    // Form state (UI-only)
    const [formData, setFormData] = useState<TabGroupFormData>(DEFAULT_FORM_DATA);

    // Notifications
    const { error: showError, warning: showWarning, success: showSuccess } = useNotifications();

    // Generate a URL-safe ID from a group name
    const generateGroupId = useCallback((name: string): string => {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }, []);

    // Open modal for creating a new group
    const handleCreate = useCallback((): void => {
        setModalMode('create');
        setFormData({ id: '', name: '', order: tabGroups.length });
        setSelectedGroup(null);
        setShowModal(true);
    }, [tabGroups.length]);

    // Open modal for editing an existing group
    const handleEdit = useCallback((group: TabGroup): void => {
        setModalMode('edit');
        setFormData({ id: group.id, name: group.name, order: group.order ?? 0 });
        setSelectedGroup(group);
        setShowModal(true);
    }, []);

    // Submit form (create or update)
    const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        if (!formData.name.trim()) {
            showWarning('Missing Name', 'Group name is required');
            return;
        }

        const groupId = modalMode === 'create' ? generateGroupId(formData.name) : formData.id;

        if (modalMode === 'create' && tabGroups.some(g => g.id === groupId)) {
            showWarning('Duplicate Group', `A group with ID "${groupId}" already exists.`);
            return;
        }

        const newGroup: TabGroup = {
            id: groupId,
            name: formData.name,
            order: formData.order || 0
        };

        try {
            const updatedGroups = modalMode === 'create'
                ? [...tabGroups, newGroup]
                : tabGroups.map(g => g.id === groupId ? newGroup : g);

            await updateTabGroups.mutateAsync(updatedGroups);
            setShowModal(false);
            // Notify sidebar to update groups immediately
            window.dispatchEvent(new Event('tabGroupsUpdated'));
            showSuccess(
                modalMode === 'create' ? 'Group Created' : 'Group Updated',
                `Tab group "${formData.name}" ${modalMode === 'create' ? 'created' : 'updated'} successfully`
            );
        } catch (error) {
            const err = error as Error & { response?: { data?: { error?: string } } };
            showError('Save Failed', err.response?.data?.error || 'Failed to save group');
        }
    }, [formData, modalMode, tabGroups, generateGroupId, updateTabGroups, showSuccess, showWarning, showError]);

    // Delete a group
    const handleDelete = useCallback(async (group: TabGroup): Promise<void> => {
        try {
            await updateTabGroups.mutateAsync(tabGroups.filter(g => g.id !== group.id));
            // Notify sidebar to update groups and tabs immediately
            // (server cleans up groupId on affected tabs)
            window.dispatchEvent(new Event('tabGroupsUpdated'));
            window.dispatchEvent(new Event('tabsUpdated'));
            showSuccess('Group Deleted', `Group "${group.name}" deleted`);
        } catch (error) {
            showError('Delete Failed', 'Failed to delete group');
        }
    }, [tabGroups, updateTabGroups, showSuccess, showError]);

    // Handle drag-and-drop reordering
    const handleDragEnd = useCallback(async (event: DragEndEvent): Promise<void> => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const oldIndex = tabGroups.findIndex(g => g.id === active.id);
        const newIndex = tabGroups.findIndex(g => g.id === over.id);

        const newGroups = arrayMove(tabGroups, oldIndex, newIndex);

        // Update order values
        const reorderedGroups = newGroups.map((g, idx) => ({ ...g, order: idx }));

        try {
            await updateTabGroups.mutateAsync(reorderedGroups);
            // Notify sidebar to update group order immediately
            window.dispatchEvent(new Event('tabGroupsUpdated'));
        } catch (error) {
            // React Query will automatically refetch on error, reverting the UI
        }
    }, [tabGroups, updateTabGroups]);

    return {
        // Data
        tabGroups,
        loading,

        // Modal state
        showModal,
        setShowModal,
        modalMode,
        selectedGroup,

        // Form state
        formData,
        setFormData,

        // Actions
        handleCreate,
        handleEdit,
        handleSubmit,
        handleDelete,
        handleDragEnd,

        // Utilities
        generateGroupId,
    };
}

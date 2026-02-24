/**
 * Tab Settings Hook
 * 
 * Manages all state and business logic for the tab settings page.
 * Handles CRUD operations, drag-and-drop reordering, and form state.
 * 
 * P2 Migration: Uses React Query hooks for data fetching.
 */

import { useState, useCallback, FormEvent, useMemo } from 'react';
import { useTabsList, useCreateTab, useUpdateTab, useDeleteTab, useReorderTabs, useTabGroupsList } from '../../../api/hooks';
import { arrayMove } from '@dnd-kit/sortable';
import { DragEndEvent } from '@dnd-kit/core';
import logger from '../../../utils/logger';
import { useNotifications } from '../../../context/NotificationContext';
import type { Tab, TabGroup, TabFormData, ModalMode } from '../types';

/** Default form values for creating a new tab */
const DEFAULT_FORM_DATA: TabFormData = {
    name: '',
    url: '',
    icon: 'Server',
    groupId: '',
    enabled: true,
    openInNewTab: false,
};

interface UseTabSettingsReturn {
    // Data
    tabs: Tab[];
    tabGroups: TabGroup[];
    loading: boolean;

    // Modal state
    showModal: boolean;
    setShowModal: (show: boolean) => void;
    modalMode: ModalMode;
    selectedTab: Tab | null;

    // Form state
    formData: TabFormData;
    setFormData: React.Dispatch<React.SetStateAction<TabFormData>>;

    // Actions
    handleAdd: () => void;
    handleEdit: (tab: Tab) => void;
    handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
    handleDelete: (tabId: string, tabName: string) => Promise<void>;
    handleDragEnd: (event: DragEndEvent) => Promise<void>;
}

export function useTabSettings(): UseTabSettingsReturn {
    // React Query hooks for data fetching
    const tabsQuery = useTabsList();
    const tabGroupsQuery = useTabGroupsList(); // Per-user tab groups
    const createTabMutation = useCreateTab();
    const updateTabMutation = useUpdateTab();
    const deleteTabMutation = useDeleteTab();
    const reorderTabsMutation = useReorderTabs();

    // Tab groups from React Query (per-user)
    const tabGroups = useMemo(() =>
        (tabGroupsQuery.data || []) as TabGroup[],
        [tabGroupsQuery.data]
    );

    // Modal state
    const [showModal, setShowModal] = useState<boolean>(false);
    const [modalMode, setModalMode] = useState<ModalMode>('create');
    const [selectedTab, setSelectedTab] = useState<Tab | null>(null);

    // Form state
    const [formData, setFormData] = useState<TabFormData>(DEFAULT_FORM_DATA);

    // Local optimistic state for drag reordering
    const [optimisticTabs, setOptimisticTabs] = useState<Tab[] | null>(null);

    // Notifications
    const { error: showError, success: showSuccess } = useNotifications();

    // Derive tabs from query (or optimistic state during drag)
    const tabs = useMemo(() => {
        if (optimisticTabs) return optimisticTabs;
        return (tabsQuery.data?.tabs || []) as Tab[];
    }, [tabsQuery.data?.tabs, optimisticTabs]);

    const loading = tabsQuery.isLoading || tabGroupsQuery.isLoading;

    // Open modal for creating a new tab
    const handleAdd = useCallback((): void => {
        setModalMode('create');
        setSelectedTab(null);
        setFormData(DEFAULT_FORM_DATA);
        setShowModal(true);
    }, []);

    // Open modal for editing an existing tab
    const handleEdit = useCallback((tab: Tab): void => {
        setModalMode('edit');
        setSelectedTab(tab);
        setFormData({
            name: tab.name,
            url: tab.url,
            icon: tab.icon || 'Server',
            groupId: tab.groupId || '',
            enabled: tab.enabled !== false,
            openInNewTab: tab.openInNewTab || false,
        });
        setShowModal(true);
    }, []);

    // Submit form (create or update)
    const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        try {
            if (modalMode === 'create') {
                await createTabMutation.mutateAsync(formData);
            } else {
                await updateTabMutation.mutateAsync({ id: selectedTab!.id, data: formData });
            }
            setShowModal(false);
            // Notify sidebar to update
            window.dispatchEvent(new Event('tabsUpdated'));
            showSuccess(
                modalMode === 'create' ? 'Tab Created' : 'Tab Updated',
                `Tab "${formData.name}" ${modalMode === 'create' ? 'created' : 'updated'} successfully`
            );
        } catch (error) {
            const err = error as Error & { response?: { data?: { error?: string } } };
            logger.error('Error saving tab:', error);
            showError('Save Failed', err.response?.data?.error || 'Failed to save tab');
        }
    }, [modalMode, selectedTab, formData, createTabMutation, updateTabMutation, showSuccess, showError]);

    // Delete a tab
    const handleDelete = useCallback(async (tabId: string, tabName: string): Promise<void> => {
        try {
            await deleteTabMutation.mutateAsync(tabId);
            // Notify sidebar to update
            window.dispatchEvent(new Event('tabsUpdated'));
            showSuccess('Tab Deleted', `Tab "${tabName}" deleted`);
        } catch (error) {
            const err = error as Error & { response?: { data?: { error?: string } } };
            logger.error('Error deleting tab:', error);
            showError('Delete Failed', err.response?.data?.error || 'Failed to delete tab');
        }
    }, [deleteTabMutation, showSuccess, showError]);

    // Handle drag-and-drop reordering
    const handleDragEnd = useCallback(async (event: DragEndEvent): Promise<void> => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const oldIndex = tabs.findIndex(t => t.id === active.id);
        const newIndex = tabs.findIndex(t => t.id === over.id);

        const newTabs = arrayMove(tabs, oldIndex, newIndex);

        // Optimistic update
        setOptimisticTabs(newTabs);

        // Persist to server
        try {
            const orderedIds = newTabs.map(t => t.id);
            await reorderTabsMutation.mutateAsync(orderedIds);
            // Notify sidebar to update
            window.dispatchEvent(new Event('tabsUpdated'));
            // Clear optimistic state - query cache now has correct data
            setOptimisticTabs(null);
        } catch (error) {
            logger.error('Error reordering tabs:', error);
            // Revert optimistic update by clearing it (query has original data)
            setOptimisticTabs(null);
        }
    }, [tabs, reorderTabsMutation]);

    return {
        // Data
        tabs,
        tabGroups,
        loading,

        // Modal state
        showModal,
        setShowModal,
        modalMode,
        selectedTab,

        // Form state
        formData,
        setFormData,

        // Actions
        handleAdd,
        handleEdit,
        handleSubmit,
        handleDelete,
        handleDragEnd,
    };
}

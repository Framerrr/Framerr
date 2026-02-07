import React from 'react';
import { Layout, Plus } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '../../shared/ui';
import { SettingsPage, SettingsSection } from '../../shared/ui/settings';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useTabSettings } from './hooks/useTabSettings';
import { TabItem } from './components/TabItem';
import { TabFormModal } from './components/TabFormModal';

export const TabSettings: React.FC = () => {
    const {
        // Data
        tabs,
        tabGroups,
        loading,
        // Modal state
        showModal,
        setShowModal,
        modalMode,
        // Form state
        formData,
        setFormData,
        // Actions
        handleAdd,
        handleEdit,
        handleSubmit,
        handleDelete,
        handleDragEnd,
    } = useTabSettings();

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 150,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="lg" message="Loading tabs..." />
            </div>
        );
    }

    return (
        <SettingsPage
            title="My Tabs"
            description="Manage your personal sidebar tabs - only you can see these"
        >
            <SettingsSection
                title="Tabs"
                icon={Layout}
                headerRight={
                    <Button onClick={handleAdd} title="Add new tab" icon={Plus} size="md" textSize="sm">
                        <span className="hidden sm:inline">Add Tab</span>
                    </Button>
                }
            >
                {/* Tabs List */}
                {tabs.length === 0 ? (
                    <div className="rounded-lg p-12 text-center border border-theme-light bg-theme-tertiary">
                        <Layout size={48} className="mx-auto mb-4 opacity-50 text-theme-tertiary" />
                        <p className="text-theme-secondary">
                            No tabs yet. Add your first tab to get started!
                        </p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={tabs.map((t) => t.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-3">
                                {tabs.map((tab) => (
                                    <TabItem
                                        key={tab.id}
                                        tab={tab}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </SettingsSection>

            {/* Tab Form Modal */}
            <TabFormModal
                open={showModal}
                onOpenChange={setShowModal}
                mode={modalMode}
                formData={formData}
                onFormChange={setFormData}
                onSubmit={handleSubmit}
                tabGroups={tabGroups}
            />
        </SettingsPage>
    );
};

// Default export for backward compatibility
export default TabSettings;

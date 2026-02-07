/**
 * GroupSection
 * 
 * Tab groups management for the Tabs settings.
 * Uses shared SettingsPage and SettingsSection for consistent animation behavior.
 */

import React from 'react';
import { FolderTree, Plus } from 'lucide-react';
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
import { Button } from '../../../shared/ui';
import { SettingsPage, SettingsSection } from '../../../shared/ui/settings';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { useGroupSettings } from '../hooks/useGroupSettings';
import { GroupItem } from '../components/GroupItem';
import { GroupFormModal } from '../components/GroupFormModal';

export const GroupSection: React.FC = () => {
    const {
        tabGroups,
        loading,
        showModal,
        setShowModal,
        modalMode,
        selectedGroup,
        formData,
        setFormData,
        handleCreate,
        handleEdit,
        handleSubmit,
        handleDelete,
        handleDragEnd,
        generateGroupId,
    } = useGroupSettings();

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 150,
                tolerance: 5
            }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="lg" message="Loading tab groups..." />
            </div>
        );
    }

    return (
        <SettingsPage
            title="Tab Groups"
            description="Organize your tabs into collapsible sidebar groups"
        >
            <SettingsSection
                title="Groups"
                icon={FolderTree}
                headerRight={
                    <Button
                        onClick={handleCreate}
                        title="Add new group"
                        icon={Plus}
                        size="md"
                        textSize="sm"
                    >
                        <span className="hidden sm:inline">Add Group</span>
                    </Button>
                }
            >
                {/* Groups List */}
                {tabGroups.length === 0 ? (
                    <div className="rounded-lg p-12 text-center border border-theme-light bg-theme-tertiary">
                        <FolderTree size={48} className="mx-auto mb-4 opacity-50 text-theme-tertiary" />
                        <p className="text-theme-secondary">No tab groups yet. Create one to organize your sidebar tabs!</p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={tabGroups.map(g => g.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-3">
                                {tabGroups.map((group) => (
                                    <GroupItem
                                        key={group.id}
                                        group={group}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </SettingsSection>

            {/* Modal */}
            <GroupFormModal
                open={showModal}
                onOpenChange={setShowModal}
                mode={modalMode}
                selectedGroup={selectedGroup}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                generateGroupId={generateGroupId}
            />
        </SettingsPage>
    );
};

export default GroupSection;

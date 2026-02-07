/**
 * UserGroupsSection
 * 
 * Admin UI for managing custom user groups.
 * Groups are used as UI convenience in sharing workflows.
 */

import React from 'react';
import { Plus, Users, Pencil } from 'lucide-react';
import { Button, Modal, ConfirmButton } from '../../../shared/ui';
import { SettingsPage, SettingsSection, EmptyState } from '../../../shared/ui/settings';
import { useUserGroups, UserGroup } from '../hooks/useUserGroups';

// ============================================================================
// Group Card Component
// ============================================================================

interface GroupCardProps {
    group: UserGroup;
    onEdit: (group: UserGroup) => void;
    onDelete: (id: string) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, onEdit, onDelete }) => {
    return (
        <div className="p-4 rounded-xl border border-theme bg-theme-tertiary hover:bg-theme-hover transition-all">
            <div className="flex items-center justify-between gap-3">
                {/* Group info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-theme-tertiary">
                        <Users size={18} className="text-accent" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-medium text-theme-primary truncate">{group.name}</h4>
                        <p className="text-xs text-theme-secondary">
                            {group.memberCount === 0 ? 'No members' :
                                group.memberCount === 1 ? '1 member' :
                                    `${group.memberCount} members`}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        onClick={() => onEdit(group)}
                        title="Edit group"
                    />
                    <ConfirmButton
                        onConfirm={() => onDelete(group.id)}
                        confirmMode="iconOnly"
                        size="sm"
                        anchorButton="cancel"
                        expandDirection="left"
                    />
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const UserGroupsSection: React.FC = () => {
    const {
        groups,
        loading,
        error,
        showModal,
        modalMode,
        formData,
        submitting,
        handleCreate,
        handleEdit,
        handleSubmit,
        closeModal,
        setFormData,
        deleteGroup
    } = useUserGroups();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-theme-secondary">Loading groups...</div>
            </div>
        );
    }

    return (
        <SettingsPage
            title="Groups"
            description="Organize users into groups for easier sharing"
        >
            <SettingsSection
                title="Your Groups"
                icon={Users}
                headerRight={
                    <Button onClick={handleCreate} icon={Plus} size="md" textSize="sm">
                        <span className="hidden sm:inline">Add Group</span>
                    </Button>
                }
            >
                {/* Error Display */}
                {error && (
                    <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 mb-4">
                        {error}
                    </div>
                )}

                {/* Groups Grid */}
                {groups.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        message="No groups created yet. Create groups like 'Family' or 'Friends' to organize sharing."
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groups.map(group => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                onEdit={handleEdit}
                                onDelete={deleteGroup}
                            />
                        ))}
                    </div>
                )}
            </SettingsSection>

            {/* Create/Edit Modal */}
            <Modal
                open={showModal}
                onOpenChange={(open) => !open && closeModal()}
            >
                <Modal.Header
                    title={modalMode === 'create' ? 'Create Group' : 'Edit Group'}
                    showClose
                />
                <Modal.Body>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-theme-primary mb-2">
                                Group Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ name: e.target.value })}
                                placeholder="e.g., Family, Friends, Power Users"
                                maxLength={50}
                                autoFocus
                                className="w-full px-3 py-2 rounded-lg border border-theme bg-theme-secondary text-theme-primary placeholder-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={closeModal}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={!formData.name.trim() || submitting}
                        >
                            {submitting ? 'Saving...' : modalMode === 'create' ? 'Create' : 'Save'}
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>
        </SettingsPage>
    );
};

export default UserGroupsSection;

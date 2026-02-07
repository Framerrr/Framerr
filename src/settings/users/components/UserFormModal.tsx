/**
 * User Form Modal
 * 
 * Modal for creating and editing users.
 * Includes group selection for custom sharing groups.
 */

import React, { ChangeEvent, FormEvent, useState } from 'react';
import { Save, ChevronDown, Check } from 'lucide-react';
import { Modal, Popover, Checkbox, Button } from '../../../shared/ui';
import { Input } from '../../../components/common/Input';
import type { UserFormData, ModalMode } from '../types';
import type { UserGroup } from '../hooks/useUserGroups';

interface UserFormModalProps {
    isOpen: boolean;
    mode: ModalMode;
    formData: UserFormData;
    groups: UserGroup[];
    onClose: () => void;
    onSubmit: (e: FormEvent<HTMLFormElement>) => void;
    onUpdateField: <K extends keyof UserFormData>(field: K, value: UserFormData[K]) => void;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
    isOpen,
    mode,
    formData,
    groups,
    onClose,
    onSubmit,
    onUpdateField,
}) => {
    const [groupsOpen, setGroupsOpen] = useState(false);

    // Toggle a group in the selection
    const handleGroupToggle = (groupId: string) => {
        const currentIds = formData.groupIds || [];
        const newIds = currentIds.includes(groupId)
            ? currentIds.filter(id => id !== groupId)
            : [...currentIds, groupId];
        onUpdateField('groupIds', newIds);
    };

    // Get display text for selected groups
    const getGroupsDisplayText = () => {
        const selectedIds = formData.groupIds || [];
        if (selectedIds.length === 0) return 'No groups assigned';

        const selectedNames = groups
            .filter(g => selectedIds.includes(g.id))
            .map(g => g.name);

        if (selectedNames.length === 1) return selectedNames[0];
        if (selectedNames.length === 2) return selectedNames.join(' & ');
        return `${selectedNames.length} groups`;
    };

    return (
        <Modal open={isOpen} onOpenChange={(open) => !open && onClose()} size="sm">
            <Modal.Header title={mode === 'create' ? 'Create User' : 'Edit User'} />
            <Modal.Body>
                <form onSubmit={onSubmit} className="space-y-4" id="user-form">
                    <Input
                        label="Username"
                        value={formData.username}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdateField('username', e.target.value)}
                        required
                    />

                    <Input
                        label="Email (Optional)"
                        type="email"
                        value={formData.email}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdateField('email', e.target.value)}
                        placeholder="user@example.com"
                        helperText="If set, user can login with either username or email"
                    />

                    <Input
                        label={`Password ${mode === 'edit' ? '(leave blank to keep current)' : ''}`}
                        type="password"
                        value={formData.password}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdateField('password', e.target.value)}
                        required={mode === 'create'}
                    />

                    {/* Group Selection Dropdown */}
                    {groups.length > 0 && (
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-theme-primary">
                                Groups
                            </label>
                            <Popover open={groupsOpen} onOpenChange={setGroupsOpen}>
                                <Popover.Trigger asChild>
                                    <button
                                        type="button"
                                        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-theme-tertiary border border-theme rounded-lg text-sm text-theme-primary hover:bg-theme-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                    >
                                        <span className={(formData.groupIds || []).length === 0 ? 'text-theme-tertiary' : ''}>
                                            {getGroupsDisplayText()}
                                        </span>
                                        <ChevronDown size={16} className="text-theme-secondary" />
                                    </button>
                                </Popover.Trigger>
                                <Popover.Content align="start" className="w-64 p-1">
                                    <div
                                        className="max-h-48 overflow-y-scroll overscroll-contain"
                                        onWheel={(e) => e.stopPropagation()}
                                        data-scroll-lock-allow
                                    >
                                        {groups.map(group => {
                                            const isSelected = (formData.groupIds || []).includes(group.id);
                                            return (
                                                <button
                                                    key={group.id}
                                                    type="button"
                                                    onClick={() => handleGroupToggle(group.id)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-theme-primary hover:bg-theme-hover rounded transition-colors"
                                                >
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => handleGroupToggle(group.id)}
                                                    />
                                                    <span>{group.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {groups.length === 0 && (
                                        <div className="px-3 py-2 text-sm text-theme-tertiary">
                                            No groups available
                                        </div>
                                    )}
                                </Popover.Content>
                            </Popover>
                            <p className="text-xs text-theme-tertiary">
                                Assign user to groups for easier sharing
                            </p>
                        </div>
                    )}
                </form>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="button"
                    onClick={onClose}
                    variant="secondary"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    form="user-form"
                    icon={Save}
                >
                    {mode === 'create' ? 'Create User' : 'Save Changes'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

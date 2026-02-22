/**
 * User Form Modal
 * 
 * Modal for creating and editing users.
 * Includes group selection using MultiSelectDropdown.
 */

import React, { ChangeEvent, FormEvent, useMemo } from 'react';
import { Save } from 'lucide-react';
import { Modal, MultiSelectDropdown, Button, Select } from '../../../shared/ui';
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
    // Map groups to MultiSelectDropdown options
    const groupOptions = useMemo(
        () => groups.map(g => ({ id: g.id, label: g.name })),
        [groups]
    );

    return (
        <Modal open={isOpen} onOpenChange={(open) => !open && onClose()} size="md">
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

                    {/* Role Selection */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-theme-primary">
                            Role
                        </label>
                        <Select value={formData.group} onValueChange={(value) => onUpdateField('group', value)}>
                            <Select.Trigger className="w-full">
                                <Select.Value placeholder="Select role" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="user">User</Select.Item>
                                <Select.Item value="admin">Admin</Select.Item>
                            </Select.Content>
                        </Select>
                        {formData.group === 'admin' && (
                            <p className="text-xs text-warning">
                                Admins have full access to all settings, integrations, and user management
                            </p>
                        )}
                        {formData.group !== 'admin' && (
                            <p className="text-xs text-theme-tertiary">
                                Users can only access their dashboard and shared integrations
                            </p>
                        )}
                    </div>

                    {/* Group Selection - hidden for admins (they have full access) */}
                    {groups.length > 0 && formData.group !== 'admin' && (
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-theme-primary">
                                Groups
                            </label>
                            <MultiSelectDropdown
                                options={groupOptions}
                                selectedIds={formData.groupIds || []}
                                onChange={(ids) => onUpdateField('groupIds', ids)}
                                placeholder="No groups assigned"
                                showBulkActions={false}
                                fullWidth
                            />
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

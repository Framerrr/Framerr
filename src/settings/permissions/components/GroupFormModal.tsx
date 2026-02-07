/**
 * Modal for creating/editing permission groups
 */
import React, { FormEvent, ChangeEvent, MouseEvent } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/shared/ui';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../shared/ui';
import { PermissionGroup, PermissionFormData, AVAILABLE_PERMISSIONS } from '../types';

interface GroupFormModalProps {
    show: boolean;
    mode: 'create' | 'edit';
    selectedGroup: PermissionGroup | null;
    formData: PermissionFormData;
    onClose: () => void;
    onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
    onFormDataChange: React.Dispatch<React.SetStateAction<PermissionFormData>>;
    onTogglePermission: (permissionId: string) => void;
    generateGroupId: (name: string) => string;
}

export const GroupFormModal: React.FC<GroupFormModalProps> = ({
    show,
    mode,
    selectedGroup,
    formData,
    onClose,
    onSubmit,
    onFormDataChange,
    onTogglePermission,
    generateGroupId
}) => {
    if (!show) return null;

    return (
        <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                onClick={(e: MouseEvent) => e.stopPropagation()}
                className="glass-subtle rounded-xl shadow-deep border border-theme p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-theme-primary">
                        {mode === 'create' ? 'Create Group' : `Edit: ${selectedGroup?.name}`}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-theme-secondary hover:text-theme-primary transition-colors"
                        title="Close"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={onSubmit} className="space-y-5">
                    <Input
                        label="Group Name *"
                        value={formData.name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => onFormDataChange(prev => ({ ...prev, name: e.target.value }))}
                        required
                        placeholder="e.g., Power Users"
                        helperText={formData.name ? `ID: ${generateGroupId(formData.name)}` : ''}
                    />

                    {/* Permissions */}
                    <div>
                        <label className="block mb-3 font-medium text-theme-secondary text-sm">Permissions *</label>
                        <div className="space-y-2">
                            {AVAILABLE_PERMISSIONS.map(perm => {
                                const isChecked = formData.permissions.includes(perm.id);
                                const isWildcard = formData.permissions.includes('*');
                                const isDisabled = isWildcard && perm.id !== '*';

                                return (
                                    <label
                                        key={perm.id}
                                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${isDisabled
                                            ? 'bg-theme-tertiary/30 border-theme/30 opacity-50 cursor-not-allowed'
                                            : isChecked
                                                ? 'bg-accent/10 border-accent/30 hover:bg-accent/15'
                                                : 'bg-theme-tertiary/30 border-theme/50 hover:bg-theme-tertiary/50'
                                            }`}
                                    >
                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={() => onTogglePermission(perm.id)}
                                            disabled={isDisabled}
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span>{perm.icon}</span>
                                                <span className="font-medium text-theme-primary">{perm.label}</span>
                                            </div>
                                            <p className="text-xs text-theme-secondary mt-0.5">{perm.description}</p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>

                        {/* Warning for no permissions */}
                        {formData.permissions.length === 0 && (
                            <div className="flex items-center gap-2 mt-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                                <AlertTriangle size={16} className="text-warning" />
                                <p className="text-xs text-warning">No permissions selected - users will have very limited access</p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            onClick={onClose}
                            variant="secondary"
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1"
                            icon={Save}
                        >
                            {mode === 'create' ? 'Create' : 'Save'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

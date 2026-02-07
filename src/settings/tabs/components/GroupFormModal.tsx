/**
 * GroupFormModal Component
 * 
 * Modal for creating and editing tab groups.
 * Uses Modal primitive for consistent styling and accessibility.
 */

import React, { FormEvent, ChangeEvent } from 'react';
import { Save } from 'lucide-react';
import { Modal } from '@/shared/ui';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../shared/ui';
import type { TabGroup, TabGroupFormData, ModalMode } from '../types';

export interface GroupFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: ModalMode;
    selectedGroup: TabGroup | null;
    formData: TabGroupFormData;
    setFormData: React.Dispatch<React.SetStateAction<TabGroupFormData>>;
    onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
    generateGroupId: (name: string) => string;
}

export const GroupFormModal: React.FC<GroupFormModalProps> = ({
    open,
    onOpenChange,
    mode,
    selectedGroup,
    formData,
    setFormData,
    onSubmit,
    generateGroupId,
}) => {
    return (
        <Modal open={open} onOpenChange={onOpenChange} size="sm">
            <Modal.Header title={mode === 'create' ? 'Create Tab Group' : `Edit: ${selectedGroup?.name}`} />
            <Modal.Body>
                <form onSubmit={onSubmit} className="space-y-4" id="group-form">
                    <Input
                        label="Group Name *"
                        value={formData.name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        placeholder="e.g., Media, Downloads, System"
                        helperText={formData.name ? `ID: ${generateGroupId(formData.name)}` : ''}
                    />
                </form>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => onOpenChange(false)}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    form="group-form"
                    className="flex-1"
                    icon={Save}
                >
                    {mode === 'create' ? 'Create' : 'Save'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

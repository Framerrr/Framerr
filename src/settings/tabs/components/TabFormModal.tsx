/**
 * TabFormModal Component
 * 
 * Modal dialog for creating or editing tabs.
 * Uses Modal primitive for consistent styling and accessibility.
 */

import React, { ChangeEvent, FormEvent } from 'react';
import { Save } from 'lucide-react';
import { Modal, Select, Switch } from '@/shared/ui';
import IconPicker from '../../../components/IconPicker';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../shared/ui';
import type { TabGroup, TabFormData, ModalMode } from '../types';

interface TabFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: ModalMode;
    formData: TabFormData;
    onFormChange: (data: TabFormData) => void;
    onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
    tabGroups: TabGroup[];
}

export const TabFormModal: React.FC<TabFormModalProps> = ({
    open,
    onOpenChange,
    mode,
    formData,
    onFormChange,
    onSubmit,
    tabGroups,
}) => {
    return (
        <Modal open={open} onOpenChange={onOpenChange} size="md">
            <Modal.Header
                title={mode === 'create' ? 'Add New Tab' : 'Edit Tab'}
                actions={mode === 'edit' ? (
                    <Switch
                        checked={formData.enabled}
                        onCheckedChange={(checked) =>
                            onFormChange({ ...formData, enabled: checked })
                        }
                    />
                ) : undefined}
            />
            <Modal.Body>
                <form onSubmit={onSubmit} className="space-y-4" id="tab-form">
                    <Input
                        label="Tab Name"
                        value={formData.name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            onFormChange({ ...formData, name: e.target.value })
                        }
                        required
                        placeholder="e.g., Radarr"
                        helperText="Appears in sidebar (URL slug auto-generated)"
                    />

                    <Input
                        label="URL"
                        type="url"
                        value={formData.url}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            onFormChange({ ...formData, url: e.target.value })
                        }
                        required
                        placeholder="http://example.com"
                    />

                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block font-medium text-theme-secondary text-sm">
                                Open in new tab
                            </label>
                            <p className="text-xs text-theme-tertiary mt-0.5">
                                Opens the URL directly in a new browser tab
                            </p>
                        </div>
                        <Switch
                            checked={formData.openInNewTab}
                            onCheckedChange={(checked) =>
                                onFormChange({ ...formData, openInNewTab: checked })
                            }
                        />
                    </div>

                    <div>
                        <label className="block mb-2 font-medium text-theme-secondary text-sm">
                            Icon
                        </label>
                        <IconPicker
                            value={formData.icon}
                            onChange={(icon: string) =>
                                onFormChange({ ...formData, icon })
                            }
                        />
                    </div>

                    <div>
                        <label className="block mb-2 font-medium text-theme-secondary text-sm">
                            Group (Optional)
                        </label>
                        <Select
                            value={formData.groupId || '__none__'}
                            onValueChange={(value) => onFormChange({ ...formData, groupId: value === '__none__' ? '' : value })}
                        >
                            <Select.Trigger className="w-full">
                                <Select.Value placeholder="No Group" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="__none__">No Group</Select.Item>
                                {tabGroups.map((group) => (
                                    <Select.Item key={group.id} value={group.id}>{group.name}</Select.Item>
                                ))}
                            </Select.Content>
                        </Select>
                        <p className="text-xs text-theme-tertiary mt-1">
                            Organize tabs into groups in the sidebar
                        </p>
                    </div>
                </form>
            </Modal.Body>
            <Modal.Footer>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancel
                </Button>
                <Button type="submit" form="tab-form" icon={Save}>
                    {mode === 'create' ? 'Create Tab' : 'Save Changes'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

/**
 * LinkFormModal Component
 * 
 * Modal for adding/editing links in the LinkGrid widget.
 * Handles title, icon, shape, type (link vs action), URL, and display options.
 */

import React from 'react';
import { Modal, Checkbox, Select, ConfirmButton, Button } from '../../../shared/ui';
import IconPicker from '../../../components/IconPicker';
import type { LinkFormData, HttpMethod } from '../types';

interface LinkFormModalProps {
    isOpen: boolean;
    isEditing: boolean;
    editingLinkId: string | null;
    formData: LinkFormData;
    setFormData: React.Dispatch<React.SetStateAction<LinkFormData>>;
    onSave: () => void;
    onDelete: (linkId: string) => void;
    onClose: () => void;
}

export const LinkFormModal: React.FC<LinkFormModalProps> = ({
    isOpen,
    isEditing,
    editingLinkId,
    formData,
    setFormData,
    onSave,
    onDelete,
    onClose,
}) => {
    return (
        <Modal open={isOpen} onOpenChange={(open) => !open && onClose()} size="sm">
            <Modal.Header title={isEditing ? 'Edit Link' : 'Add New Link'} />
            <Modal.Body>
                <div className="space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-xs text-theme-secondary mb-1">Title</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 bg-theme-tertiary border border-theme rounded text-sm text-theme-primary focus:border-accent focus:outline-none"
                            placeholder="Enter link title"
                        />
                    </div>

                    {/* Shape selector */}
                    <div>
                        <label className="block text-xs text-theme-secondary mb-1">Shape</label>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setFormData({ ...formData, size: 'circle' })}
                                className={`flex-1 px-4 py-3 rounded-lg text-sm transition-all flex flex-col items-center gap-2 ${formData.size === 'circle'
                                    ? 'bg-accent text-white ring-2 ring-accent ring-offset-2 ring-offset-theme-secondary'
                                    : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${formData.size === 'circle' ? 'border-white' : 'border-theme'}`}>
                                    <span className="text-xs font-medium">1×1</span>
                                </div>
                                <span className="text-xs font-medium">Circle</span>
                            </button>
                            <button
                                onClick={() => setFormData({ ...formData, size: 'rectangle' })}
                                className={`flex-1 px-4 py-3 rounded-lg text-sm transition-all flex flex-col items-center gap-2 ${formData.size === 'rectangle'
                                    ? 'bg-accent text-white ring-2 ring-accent ring-offset-2 ring-offset-theme-secondary'
                                    : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                                    }`}
                            >
                                <div className={`w-20 h-12 rounded-full border-2 flex items-center justify-center ${formData.size === 'rectangle' ? 'border-white' : 'border-theme'}`}>
                                    <span className="text-xs font-medium">2×1</span>
                                </div>
                                <span className="text-xs font-medium">Rectangle</span>
                            </button>
                        </div>
                    </div>

                    {/* Type selector */}
                    <div>
                        <label className="block text-xs text-theme-secondary mb-1">Type</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFormData({ ...formData, type: 'link' })}
                                className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${formData.type === 'link'
                                    ? 'bg-accent text-white'
                                    : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                                    }`}
                            >
                                Open Link
                            </button>
                            <button
                                onClick={() => setFormData({ ...formData, type: 'action' })}
                                className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${formData.type === 'action'
                                    ? 'bg-accent text-white'
                                    : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                                    }`}
                            >
                                HTTP Action
                            </button>
                        </div>
                    </div>

                    {/* URL (for links) or Action URL (for actions) */}
                    {formData.type === 'link' ? (
                        <div>
                            <label className="block text-xs text-theme-secondary mb-1">URL</label>
                            <input
                                type="url"
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                className="w-full px-3 py-2 bg-theme-tertiary border border-theme rounded text-sm text-theme-primary focus:border-accent focus:outline-none"
                                placeholder="https://example.com"
                            />
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs text-theme-secondary mb-1">Method</label>
                                <Select value={formData.action.method} onValueChange={(value) => setFormData({
                                    ...formData,
                                    action: { ...formData.action, method: value as HttpMethod }
                                })}>
                                    <Select.Trigger className="w-full">
                                        <Select.Value placeholder="GET" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Item value="GET">GET</Select.Item>
                                        <Select.Item value="POST">POST</Select.Item>
                                        <Select.Item value="PUT">PUT</Select.Item>
                                        <Select.Item value="DELETE">DELETE</Select.Item>
                                        <Select.Item value="PATCH">PATCH</Select.Item>
                                    </Select.Content>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs text-theme-secondary mb-1">Action URL</label>
                                <input
                                    type="url"
                                    value={formData.action.url}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        action: { ...formData.action, url: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 bg-theme-tertiary border border-theme rounded text-sm text-theme-primary focus:border-accent focus:outline-none"
                                    placeholder="https://api.example.com/action"
                                />
                            </div>
                        </>
                    )}

                    {/* Icon Picker */}
                    <div>
                        <label className="block text-xs text-theme-secondary mb-1">Icon</label>
                        <IconPicker
                            value={formData.icon}
                            onChange={(icon: string) => setFormData({ ...formData, icon })}
                        />
                    </div>

                    {/* Display options */}
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm text-theme-secondary cursor-pointer">
                            <Checkbox
                                checked={formData.showIcon}
                                onCheckedChange={(checked) => setFormData({ ...formData, showIcon: checked === true })}
                                size="sm"
                            />
                            Show Icon
                        </label>
                        <label className="flex items-center gap-2 text-sm text-theme-secondary cursor-pointer">
                            <Checkbox
                                checked={formData.showText}
                                onCheckedChange={(checked) => setFormData({ ...formData, showText: checked === true })}
                                size="sm"
                            />
                            Show Text
                        </label>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <div className="flex gap-2 w-full">
                    {/* Delete button - only show when editing existing link */}
                    {editingLinkId && (
                        <ConfirmButton
                            onConfirm={() => {
                                onDelete(editingLinkId);
                                onClose();
                            }}
                            label="Delete"
                            size="md"
                            confirmMode="icon"
                        />
                    )}
                    <div className="flex-1" />
                    <Button
                        onClick={onClose}
                        variant="secondary"
                        size="md"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onSave}
                        variant="primary"
                        size="md"
                    >
                        Save Link
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

export default LinkFormModal;



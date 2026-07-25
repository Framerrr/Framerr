/**
 * LinkFormModal Component
 *
 * Modal for adding/editing links in the LinkGrid widget.
 */

import React from 'react';
import { BookmarkPlus } from 'lucide-react';
import { Modal, ConfirmButton, Button } from '../../../shared/ui';
import { LinkLibraryPicker, type LibraryLink } from '../components/LinkLibraryPicker';
import { LinkFormFields } from '../components/LinkFormFields';
import type { LinkFormData } from '../types';

export type LinkFormMode = 'create' | 'edit';

interface LinkFormModalProps {
    isOpen: boolean;
    mode: LinkFormMode;
    editingLinkId: string | null;
    formData: LinkFormData;
    setFormData: React.Dispatch<React.SetStateAction<LinkFormData>>;
    onSave: () => void;
    onSaveToLibrary: () => void;
    onDelete: (linkId: string) => void;
    onClose: () => void;
    libraryLinks?: LibraryLink[];
    onLibrarySelect?: (link: LibraryLink) => void;
    onLibraryDelete?: (linkId: string) => void;
}

export const LinkFormModal: React.FC<LinkFormModalProps> = ({
    isOpen,
    mode,
    editingLinkId,
    formData,
    setFormData,
    onSave,
    onSaveToLibrary,
    onDelete,
    onClose,
    libraryLinks = [],
    onLibrarySelect,
    onLibraryDelete,
}) => {
    const isEditing = mode === 'edit';
    const title = isEditing ? 'Edit Link' : 'New Link';

    return (
        <Modal open={isOpen} onOpenChange={(open) => !open && onClose()} size="md">
            <Modal.Header title={title} />
            <Modal.Body>
                <div className="space-y-5">
                    {libraryLinks.length > 0 && (
                        <LinkLibraryPicker
                            libraryLinks={libraryLinks}
                            onSelect={(link) => onLibrarySelect?.(link)}
                            onDelete={(id) => onLibraryDelete?.(id)}
                        />
                    )}

                    <LinkFormFields variant="grid" formData={formData} setFormData={setFormData} />
                </div>
            </Modal.Body>
            <Modal.Footer>
                <div className="flex gap-2 w-full">
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

                    <Button
                        onClick={onSaveToLibrary}
                        variant="secondary"
                        size="md"
                        title="Save as library template"
                    >
                        <BookmarkPlus size={16} />
                    </Button>

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
                        disabled={
                            formData.type === 'link' &&
                            formData.linkTarget === 'dashboard' &&
                            !formData.dashboardId
                        }
                    >
                        {isEditing ? 'Update Link' : 'Save Link'}
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

export default LinkFormModal;

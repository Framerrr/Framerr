import React from 'react';
import { Modal } from '../../../shared/ui';

interface UnsavedChangesModalProps {
    isOpen: boolean;
    onCancel: () => void;
    onDiscard: () => void;
    onSave: () => void;
}

/**
 * UnsavedChangesModal - Shows when navigating away with unsaved dashboard changes
 * Offers Cancel (stay), Discard (revert + navigate), or Save (save + navigate)
 */
const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
    isOpen,
    onCancel,
    onDiscard,
    onSave
}) => {
    return (
        <Modal open={isOpen} onOpenChange={(open) => !open && onCancel()} size="sm">
            <Modal.Header title="Unsaved Changes" />
            <Modal.Body>
                <p className="text-theme-secondary">
                    You have unsaved changes to your dashboard layout.
                    Would you like to save before leaving?
                </p>
            </Modal.Body>
            <Modal.Footer>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary bg-theme-tertiary hover:bg-theme-hover border border-theme rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={onDiscard}
                    className="px-4 py-2 text-sm font-medium text-error hover:text-error bg-error/10 hover:bg-error/20 border border-error/30 rounded-lg transition-colors"
                >
                    Discard
                </button>
                <button
                    onClick={onSave}
                    className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                >
                    Save
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default UnsavedChangesModal;

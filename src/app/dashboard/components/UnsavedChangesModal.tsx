import React from 'react';
import { ConfirmDialog } from '../../../shared/ui';

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
        <ConfirmDialog
            open={isOpen}
            onOpenChange={(open) => !open && onCancel()}
            onConfirm={onSave}
            title="Unsaved Changes"
            message="You have unsaved changes to your dashboard layout. Would you like to save before leaving?"
            confirmLabel="Save"
            variant="primary"
            showIcon={false}
            secondaryAction={{
                label: 'Discard',
                onClick: onDiscard,
                variant: 'danger',
            }}
        />
    );
};

export default UnsavedChangesModal;

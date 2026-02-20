import React from 'react';
import { ConfirmDialog } from '../../../shared/ui';

interface RelinkConfirmationModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * RelinkConfirmationModal - Shows when user wants to re-link mobile to desktop
 * Confirms that custom mobile layouts will be lost
 */
const RelinkConfirmationModal: React.FC<RelinkConfirmationModalProps> = ({
    isOpen,
    onConfirm,
    onCancel
}) => {
    return (
        <ConfirmDialog
            open={isOpen}
            onOpenChange={(open) => !open && onCancel()}
            onConfirm={onConfirm}
            title="Re-link Mobile Layout?"
            message={`This will remove your custom mobile layout and restore automatic synchronization from desktop.\n\nYour mobile layout will be regenerated from your desktop layout. Any manual mobile changes will be permanently lost.`}
            confirmLabel="Re-link to Desktop"
            variant="warning"
        />
    );
};

export default RelinkConfirmationModal;

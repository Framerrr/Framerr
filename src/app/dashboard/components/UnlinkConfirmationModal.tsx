import React from 'react';
import { ConfirmDialog } from '../../../shared/ui';

interface UnlinkConfirmationModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    onDiscard?: () => void;  // Optional - shown when navigating away
}

/**
 * UnlinkConfirmationModal - Shows when saving changes that will unlink mobile from desktop
 * Final confirmation before making mobile dashboard independent
 * When onDiscard is provided, shows a 3-button layout for navigation scenarios
 */
const UnlinkConfirmationModal: React.FC<UnlinkConfirmationModalProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    onDiscard
}) => {
    return (
        <ConfirmDialog
            open={isOpen}
            onOpenChange={(open) => !open && onCancel()}
            onConfirm={onConfirm}
            title="Save Custom Mobile Layout?"
            message={`Your mobile layout will become independent from desktop. Changes made at one breakpoint will not affect the other.\n\nYou can re-link to desktop anytime from Edit mode.`}
            confirmLabel="Save and Customize"
            variant="primary"
            showIcon={false}
            secondaryAction={onDiscard ? {
                label: 'Discard',
                onClick: onDiscard,
                variant: 'danger',
            } : undefined}
        />
    );
};

export default UnlinkConfirmationModal;

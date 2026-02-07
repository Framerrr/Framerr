import React, { useState } from 'react';
import { Modal, Checkbox } from '../../../shared/ui';

interface MobileEditDisclaimerModalProps {
    isOpen: boolean;
    onContinue: () => void;
    onCancel: () => void;
    onDismissForever: () => void;
}

/**
 * MobileEditDisclaimerModal - Shows when entering edit mode on mobile while linked
 * Informs user that editing on mobile will create an independent mobile layout
 */
const MobileEditDisclaimerModal: React.FC<MobileEditDisclaimerModalProps> = ({
    isOpen,
    onContinue,
    onCancel,
    onDismissForever
}) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const handleContinue = (): void => {
        if (dontShowAgain) {
            onDismissForever();
        }
        onContinue();
    };

    const handleClose = (): void => {
        setDontShowAgain(false);
        onCancel();
    };

    return (
        <Modal open={isOpen} onOpenChange={(open) => !open && handleClose()} size="sm">
            <Modal.Header title="Mobile Dashboard Editing" />
            <Modal.Body>
                <div className="space-y-4">
                    <p className="text-theme-secondary">
                        When you rearrange widgets here, your mobile layout becomes
                        customized separately from your desktop dashboard.
                    </p>

                    <ul className="text-sm text-theme-secondary space-y-2 list-disc list-inside">
                        <li>Desktop changes will not affect mobile</li>
                        <li>Mobile changes will not affect desktop</li>
                        <li>Adding or deleting widgets will only affect mobile</li>
                    </ul>

                    <p className="text-sm text-theme-tertiary">
                        You can reconnect to desktop anytime in Settings.
                    </p>

                    <label className="flex items-center gap-2 text-sm text-theme-secondary cursor-pointer">
                        <Checkbox
                            checked={dontShowAgain}
                            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                        />
                        Don&apos;t show this again
                    </label>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary bg-theme-tertiary hover:bg-theme-hover border border-theme rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleContinue}
                    className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                >
                    Continue Editing
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default MobileEditDisclaimerModal;

import React from 'react';
import { Modal } from '../../../shared/ui';
import { Link } from 'lucide-react';

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
        <Modal open={isOpen} onOpenChange={(open) => !open && onCancel()} size="sm">
            <Modal.Header title="Re-link Mobile Layout?" />
            <Modal.Body>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                        <Link className="text-warning shrink-0" size={20} />
                        <p className="text-sm text-theme-secondary">
                            This will remove your custom mobile layout and restore automatic synchronization from desktop.
                        </p>
                    </div>

                    <p className="text-theme-secondary">
                        Your mobile layout will be regenerated from your desktop layout.
                        Any manual mobile changes will be permanently lost.
                    </p>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary bg-theme-tertiary hover:bg-theme-hover border border-theme rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors flex items-center gap-2"
                >
                    <Link size={16} />
                    Re-link to Desktop
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default RelinkConfirmationModal;

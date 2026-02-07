/**
 * ConfirmStopModal Component
 *
 * Confirmation dialog for stopping media playback sessions.
 * Admin-only action with loading state during termination.
 * Uses shared Modal component for proper portal rendering.
 *
 * Phase 4: Updated to use MediaSession type.
 */

import React, { useState } from 'react';
import { Loader2, StopCircle } from 'lucide-react';
import { Modal, Button } from '../../../shared/ui';
import type { MediaSession } from '../adapters';

const DEFAULT_TERMINATE_MESSAGE = 'The server owner has ended this stream';

interface ConfirmStopModalProps {
    session: MediaSession;
    isLoading: boolean;
    onConfirm: (message: string) => void;
    onCancel: () => void;
}

export const ConfirmStopModal: React.FC<ConfirmStopModalProps> = ({
    session,
    isLoading,
    onConfirm,
    onCancel
}) => {
    const [message, setMessage] = useState('');

    const handleConfirm = () => {
        // Use default message if field is empty
        onConfirm(message.trim() || DEFAULT_TERMINATE_MESSAGE);
    };

    return (
        <Modal open={true} onOpenChange={(open) => !open && onCancel()} size="sm">
            <Modal.Header
                title="Stop Playback?"
                icon={<StopCircle size={20} className="text-error" />}
            />
            <Modal.Body>
                <p className="text-theme-secondary">
                    Stop playback for <strong className="text-theme-primary">{session.userName}</strong>?
                </p>
                <p className="text-theme-tertiary text-sm mt-2">
                    This will immediately end their streaming session.
                </p>
                <div className="mt-4">
                    <label className="block text-sm text-theme-secondary mb-1">
                        Terminate Message
                    </label>
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={DEFAULT_TERMINATE_MESSAGE}
                        disabled={isLoading}
                        className="w-full px-3 py-2 bg-theme-secondary border border-theme rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    disabled={isLoading}
                >
                    Cancel
                </Button>
                <Button
                    variant="danger"
                    onClick={handleConfirm}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Stopping...
                        </>
                    ) : (
                        'Stop Playback'
                    )}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ConfirmStopModal;


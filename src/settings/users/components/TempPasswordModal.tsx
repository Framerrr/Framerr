/**
 * Temp Password Modal
 * 
 * Shown after admin resets a user's password.
 * Displays the temporary password in a large, copyable format.
 */

import React from 'react';
import { Key, Copy, Check } from 'lucide-react';
import { Modal, Button } from '../../../shared/ui';
import type { TempPassword } from '../types';

interface TempPasswordModalProps {
    tempPassword: TempPassword | null;
    username: string;
    onCopy: () => void;
    onDismiss: () => void;
}

export const TempPasswordModal: React.FC<TempPasswordModalProps> = ({
    tempPassword,
    username,
    onCopy,
    onDismiss,
}) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal
            open={!!tempPassword}
            onOpenChange={(open) => { if (!open) onDismiss(); }}
            size="sm"
        >
            <Modal.Header
                title="Password Reset"
                icon={<Key size={20} className="text-warning" />}
            />
            <Modal.Body>
                <div className="text-center space-y-4">
                    <p className="text-theme-secondary text-sm">
                        A new temporary password has been generated for <strong className="text-theme-primary">{username}</strong>.
                    </p>

                    <div
                        className="p-4 rounded-xl border border-theme bg-theme-tertiary cursor-pointer group"
                        onClick={handleCopy}
                        title="Click to copy"
                    >
                        <p className="text-xs text-theme-tertiary mb-2 uppercase tracking-wider font-medium">
                            Temporary Password
                        </p>
                        <p className="font-mono text-xl text-theme-primary select-all break-all">
                            {tempPassword?.password}
                        </p>
                    </div>

                    <button
                        onClick={handleCopy}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-tertiary text-theme-primary hover:bg-theme-hover transition-colors text-sm font-medium"
                    >
                        {copied ? (
                            <>
                                <Check size={16} className="text-success" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy size={16} />
                                Copy to clipboard
                            </>
                        )}
                    </button>

                    <p className="text-xs text-theme-tertiary">
                        The user will be required to change this password on next login.
                    </p>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={onDismiss}>
                    Done
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

import React, { ChangeEvent } from 'react';
import { User, Lock, AlertCircle, Loader, Link2 } from 'lucide-react';
import { Modal, Button, Input } from '../../../shared/ui';

interface OverseerrLinkModalProps {
    isOpen: boolean;
    username: string;
    password: string;
    error: string;
    linking: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => Promise<void>;
    onUsernameChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
}

/**
 * Modal for linking Overseerr account with credentials
 */
export const OverseerrLinkModal: React.FC<OverseerrLinkModalProps> = ({
    isOpen,
    username,
    password,
    error,
    linking,
    onClose,
    onSubmit,
    onUsernameChange,
    onPasswordChange
}) => {
    return (
        <Modal
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            size="sm"
        >
            <Modal.Header
                title="Sign in with Overseerr"
                icon={<Link2 size={20} className="text-accent" />}
            />
            <Modal.Body>
                <form id="overseerr-link-form" onSubmit={onSubmit} className="space-y-4">
                    <p className="text-sm text-theme-secondary">
                        Enter your Overseerr credentials to link your account. Your password is only used for verification.
                    </p>

                    {error && (
                        <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <Input
                        label="Email / Username"
                        value={username}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => onUsernameChange(e.target.value)}
                        placeholder="Your Overseerr email or username"
                        icon={User}
                        required
                    />

                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => onPasswordChange(e.target.value)}
                        placeholder="Your Overseerr password"
                        icon={Lock}
                        required
                    />
                </form>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    disabled={linking}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    form="overseerr-link-form"
                    disabled={linking || !username || !password}
                    icon={linking ? Loader : Link2}
                >
                    {linking ? 'Linking...' : 'Link Account'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

import React, { ChangeEvent } from 'react';
import { X, User, Lock, AlertCircle, Loader, Link2 } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { Input } from '../../../components/common/Input';

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
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
                className="glass-subtle w-full max-w-md rounded-2xl shadow-xl border border-theme p-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-theme-primary">Sign in with Overseerr</h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-theme-tertiary transition-colors text-theme-secondary hover:text-theme-primary"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
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

                    <div className="flex gap-3 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={linking || !username || !password}
                            icon={linking ? Loader : Link2}
                            className="flex-1"
                        >
                            {linking ? 'Linking...' : 'Link Account'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

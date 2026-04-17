/**
 * EncryptionSection - Backup encryption toggle with modal-based password flows
 * 
 * When OFF: Toggle on → Enable modal (password + confirm) → Save commits
 * When ON: Toggle off → Disable modal (current password) → Confirm disables
 * Change Password button → modal (old + new + confirm)
 * 
 * Toggle visually flips immediately but reverts if user cancels the modal.
 */

import React, { useState } from 'react';
import { Lock, Loader2, KeyRound } from 'lucide-react';
import { Button, Switch, Modal } from '../../../shared/ui';
import { Input } from '@/shared/ui';
import { SettingsSection } from '../../../shared/ui/settings';

interface EncryptionSectionProps {
    encryptionEnabled: boolean;
    encryptionLoading: boolean;
    onEnable: (password: string) => Promise<void>;
    onDisable: (password: string) => Promise<void>;
    onResetPassword: (newPassword: string) => Promise<void>;
}

type ModalType = null | 'enable' | 'disable' | 'reset';

export const EncryptionSection = ({
    encryptionEnabled,
    encryptionLoading,
    onEnable,
    onDisable,
    onResetPassword,
}: EncryptionSectionProps): React.JSX.Element => {
    const [modal, setModal] = useState<ModalType>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Password fields
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const resetAndClose = () => {
        setModal(null);
        setPassword('');
        setConfirmPassword('');
        setError('');
    };

    const handleToggle = () => {
        if (encryptionEnabled) {
            setModal('disable');
        } else {
            setModal('enable');
        }
        setError('');
        setPassword('');
        setConfirmPassword('');
    };

    // ── Enable ──
    const handleSubmitEnable = async () => {
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await onEnable(password);
            resetAndClose();
        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Failed to enable encryption');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Disable ──
    const handleSubmitDisable = async () => {
        if (!password) {
            setError('Password is required');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await onDisable(password);
            resetAndClose();
        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Failed to disable encryption');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Reset Password ──
    const handleSubmitReset = async () => {
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await onResetPassword(password);
            resetAndClose();
        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Failed to reset password');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (encryptionLoading) {
        return (
            <SettingsSection title="Encryption">
                <div className="p-6 text-center text-theme-secondary">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                    Loading encryption status...
                </div>
            </SettingsSection>
        );
    }

    return (
        <>
            <SettingsSection
                title="Encryption"
                icon={Lock}
                headerRight={
                    encryptionEnabled ? (
                        <Button
                            onClick={() => {
                                setModal('reset');
                                setError('');
                                setPassword('');
                                setConfirmPassword('');
                            }}
                            variant="secondary"
                            size="sm"
                            icon={KeyRound}
                        >
                            Reset Password
                        </Button>
                    ) : undefined
                }
            >
                {/* Toggle Row - Level 4 styling */}
                <div className="bg-theme-tertiary rounded-lg border border-theme p-4 flex items-center justify-between">
                    <div>
                        <p className="text-theme-primary font-medium">Encrypt Backups</p>
                        <p className="text-sm text-theme-secondary mt-0.5">
                            {encryptionEnabled
                                ? 'New backups are encrypted with your password'
                                : 'When enabled, new backups will be encrypted with a password'
                            }
                        </p>
                    </div>
                    <Switch
                        checked={encryptionEnabled}
                        onCheckedChange={handleToggle}
                        disabled={isSubmitting}
                    />
                </div>
            </SettingsSection>

            {/* ═══ Enable Encryption Modal ═══ */}
            <Modal open={modal === 'enable'} onOpenChange={(open) => !open && resetAndClose()} size="sm">
                <Modal.Header title="Enable Backup Encryption" />
                <Modal.Body>
                    <p className="text-sm text-theme-secondary mb-4">
                        Choose a strong password to encrypt your backups.
                    </p>
                    <p className="text-sm text-warning/90 bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 mb-4">
                        Write this password down — you'll need it to restore backups on a different server. You can reset it later from this page, but downloaded backup files will always require the password they were created with.
                    </p>
                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        disabled={isSubmitting}
                        autoFocus
                        autoComplete="new-password"
                        error={error && !confirmPassword ? error : undefined}
                    />
                    <Input
                        label="Confirm Password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        disabled={isSubmitting}
                        autoComplete="new-password"
                        error={error && confirmPassword ? error : undefined}
                    />
                    {error && <p className="text-sm text-error -mt-2">{error}</p>}
                </Modal.Body>
                <Modal.Footer>
                    <div className="flex items-center justify-end gap-2">
                        <Button onClick={resetAndClose} variant="ghost" size="sm" disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitEnable}
                            disabled={isSubmitting || !password || !confirmPassword}
                            variant="primary"
                            size="sm"
                            loading={isSubmitting}
                        >
                            {isSubmitting ? 'Enabling...' : 'Enable Encryption'}
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>

            {/* ═══ Disable Encryption Modal ═══ */}
            <Modal open={modal === 'disable'} onOpenChange={(open) => !open && resetAndClose()} size="sm">
                <Modal.Header title="Disable Backup Encryption" />
                <Modal.Body>
                    <p className="text-sm text-theme-secondary mb-4">
                        Enter your backup password to confirm. Existing encrypted backups will remain encrypted.
                    </p>
                    <Input
                        label="Current Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your backup password"
                        disabled={isSubmitting}
                        autoFocus
                        autoComplete="current-password"
                    />
                    {error && <p className="text-sm text-error -mt-2">{error}</p>}
                </Modal.Body>
                <Modal.Footer>
                    <div className="flex items-center justify-end gap-2">
                        <Button onClick={resetAndClose} variant="ghost" size="sm" disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitDisable}
                            disabled={isSubmitting || !password}
                            variant="danger"
                            size="sm"
                            loading={isSubmitting}
                        >
                            {isSubmitting ? 'Disabling...' : 'Disable Encryption'}
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>

            {/* ═══ Reset Password Modal ═══ */}
            <Modal open={modal === 'reset'} onOpenChange={(open) => !open && resetAndClose()} size="sm">
                <Modal.Header title="Reset Encryption Password" />
                <Modal.Body>
                    <p className="text-sm text-theme-secondary mb-4">
                        Set a new password for backup encryption. Server-stored backups will be updated automatically.
                    </p>
                    <p className="text-sm text-warning/90 bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 mb-4">
                        Previously downloaded backup files will still require whatever password was set when they were downloaded. Write this password down — you'll need it to restore backups on a different server.
                    </p>
                    <Input
                        label="New Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        disabled={isSubmitting}
                        autoFocus
                        autoComplete="new-password"
                    />
                    <Input
                        label="Confirm Password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        disabled={isSubmitting}
                        autoComplete="new-password"
                    />
                    {error && <p className="text-sm text-error -mt-2">{error}</p>}
                </Modal.Body>
                <Modal.Footer>
                    <div className="flex items-center justify-end gap-2">
                        <Button onClick={resetAndClose} variant="ghost" size="sm" disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitReset}
                            disabled={isSubmitting || !password || !confirmPassword}
                            variant="primary"
                            size="sm"
                            loading={isSubmitting}
                        >
                            {isSubmitting ? 'Resetting...' : 'Reset Password'}
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>
        </>
    );
};

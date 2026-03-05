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
import { Input } from '../../../components/common/Input';
import { SettingsSection } from '../../../shared/ui/settings';

interface EncryptionSectionProps {
    encryptionEnabled: boolean;
    encryptionLoading: boolean;
    onEnable: (password: string) => Promise<void>;
    onDisable: (password: string) => Promise<void>;
    onChangePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

type ModalType = null | 'enable' | 'disable' | 'change';

export const EncryptionSection = ({
    encryptionEnabled,
    encryptionLoading,
    onEnable,
    onDisable,
    onChangePassword,
}: EncryptionSectionProps): React.JSX.Element => {
    const [modal, setModal] = useState<ModalType>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Password fields
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [oldPassword, setOldPassword] = useState('');

    const resetAndClose = () => {
        setModal(null);
        setPassword('');
        setConfirmPassword('');
        setOldPassword('');
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
        setOldPassword('');
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

    // ── Change Password ──
    const handleSubmitChange = async () => {
        if (!oldPassword) {
            setError('Current password is required');
            return;
        }
        if (password.length < 8) {
            setError('New password must be at least 8 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await onChangePassword(oldPassword, password);
            resetAndClose();
        } catch (err) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Failed to change password');
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
                                setModal('change');
                                setError('');
                                setPassword('');
                                setConfirmPassword('');
                                setOldPassword('');
                            }}
                            variant="secondary"
                            size="sm"
                            icon={KeyRound}
                        >
                            Change Password
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
                        Choose a strong password to encrypt your backups. You'll need this password to restore encrypted backups.
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

            {/* ═══ Change Password Modal ═══ */}
            <Modal open={modal === 'change'} onOpenChange={(open) => !open && resetAndClose()} size="sm">
                <Modal.Header title="Change Encryption Password" />
                <Modal.Body>
                    <p className="text-sm text-theme-secondary mb-4">
                        Server-stored backups will be updated to use the new password. Previously downloaded backups keep their original password.
                    </p>
                    <Input
                        label="Current Password"
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Enter current password"
                        disabled={isSubmitting}
                        autoFocus
                        autoComplete="current-password"
                    />
                    <Input
                        label="New Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        disabled={isSubmitting}
                        autoComplete="new-password"
                    />
                    <Input
                        label="Confirm New Password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
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
                            onClick={handleSubmitChange}
                            disabled={isSubmitting || !oldPassword || !password || !confirmPassword}
                            variant="primary"
                            size="sm"
                            loading={isSubmitting}
                        >
                            {isSubmitting ? 'Changing...' : 'Change Password'}
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>
        </>
    );
};

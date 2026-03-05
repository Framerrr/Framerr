/**
 * PasswordSection
 * 
 * Conditional password form:
 * - hasLocalPassword=true: "Change Password" with current + new + confirm
 * - hasLocalPassword=false: "Set Password" with new + confirm only (for SSO-only users)
 */

import React, { ChangeEvent } from 'react';
import { Lock } from 'lucide-react';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../shared/ui';
import { SettingsSection, SettingsAlert } from '../../../shared/ui/settings';
import { PasswordFormData } from '../types';

interface PasswordSectionProps {
    password: PasswordFormData;
    changingPassword: boolean;
    passwordError: string;
    passwordSuccess: boolean;
    hasLocalPassword: boolean;
    onPasswordChange: (field: keyof PasswordFormData, value: string) => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const PasswordSection: React.FC<PasswordSectionProps> = ({
    password,
    changingPassword,
    passwordError,
    passwordSuccess,
    hasLocalPassword,
    onPasswordChange,
    onSubmit,
}) => {
    const title = hasLocalPassword ? 'Change Password' : 'Set Password';
    const submitLabel = hasLocalPassword ? 'Change Password' : 'Set Password';
    const successMessage = hasLocalPassword
        ? 'Password changed successfully!'
        : 'Password set successfully!';

    return (
        <SettingsSection title={title} icon={Lock}>
            {passwordSuccess && (
                <SettingsAlert type="success">
                    {successMessage}
                </SettingsAlert>
            )}

            {passwordError && (
                <SettingsAlert type="error">
                    {passwordError}
                </SettingsAlert>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
                {hasLocalPassword && (
                    <Input
                        label="Current Password"
                        type="password"
                        value={password.currentPassword}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => onPasswordChange('currentPassword', e.target.value)}
                        required
                    />
                )}

                <Input
                    label="New Password"
                    type="password"
                    value={password.newPassword}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onPasswordChange('newPassword', e.target.value)}
                    required
                    minLength={6}
                    helperText="At least 6 characters"
                />

                <Input
                    label="Confirm New Password"
                    type="password"
                    value={password.confirmPassword}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onPasswordChange('confirmPassword', e.target.value)}
                    required
                    minLength={6}
                />

                <Button
                    type="submit"
                    disabled={changingPassword}
                    icon={Lock}
                    size="md"
                    textSize="sm"
                >
                    {changingPassword ? 'Saving...' : submitLabel}
                </Button>
            </form>
        </SettingsSection>
    );
};

/**
 * InfoSection
 * 
 * User information display with editable display name.
 */

import React, { ChangeEvent } from 'react';
import { User, Save, Mail } from 'lucide-react';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../shared/ui';
import { SettingsSection } from '../../../shared/ui/settings';

interface InfoSectionProps {
    username: string;
    email: string;
    displayName: string;
    savingProfile: boolean;
    onDisplayNameChange: (value: string) => void;
    onSave: () => void;
}

export const InfoSection: React.FC<InfoSectionProps> = ({
    username,
    email,
    displayName,
    savingProfile,
    onDisplayNameChange,
    onSave,
}) => {
    return (
        <SettingsSection title="User Information" icon={User}>
            <div className="space-y-4">
                {/* Username (read-only) */}
                <div>
                    <label className="block text-sm font-medium text-theme-secondary mb-2">
                        Username
                    </label>
                    <div className="flex items-center gap-2 px-4 py-3 bg-theme-tertiary border border-theme rounded-lg text-theme-secondary">
                        <User size={18} />
                        <span>{username}</span>
                    </div>
                    <p className="text-xs text-theme-tertiary mt-1">Username cannot be changed</p>
                </div>

                {/* Display Name (editable) */}
                <div>
                    <Input
                        label="Display Name"
                        value={displayName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => onDisplayNameChange(e.target.value)}
                        placeholder={username}
                        helperText="This name is shown in greetings and throughout the app"
                    />
                </div>

                {/* Email (read-only) */}
                <div>
                    <label className="block text-sm font-medium text-theme-secondary mb-2">
                        Email
                    </label>
                    <div className="flex items-center gap-2 px-4 py-3 bg-theme-tertiary border border-theme rounded-lg text-theme-secondary">
                        <Mail size={18} />
                        <span>{email || 'Not set'}</span>
                    </div>
                </div>

                {/* Save Button */}
                <Button
                    onClick={onSave}
                    disabled={savingProfile}
                    icon={Save}
                    size="md"
                    textSize="sm"
                >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                </Button>
            </div>
        </SettingsSection>
    );
};

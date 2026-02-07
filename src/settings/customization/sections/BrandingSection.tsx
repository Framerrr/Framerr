/**
 * Branding Section Component
 * 
 * Admin-only section for configuring application name and icon.
 */

import React, { ChangeEvent } from 'react';
import { Palette, Save } from 'lucide-react';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../shared/ui';
import { SettingsSection } from '../../../shared/ui/settings';
import IconPicker from '../../../components/IconPicker';

interface BrandingSectionProps {
    applicationName: string;
    setApplicationName: (name: string) => void;
    applicationIcon: string;
    setApplicationIcon: (icon: string) => void;
    savingAppName: boolean;
    hasAppNameChanges: boolean;
    handleSaveApplicationName: () => Promise<void>;
}

export function BrandingSection({
    applicationName,
    setApplicationName,
    applicationIcon,
    setApplicationIcon,
    savingAppName,
    hasAppNameChanges,
    handleSaveApplicationName,
}: BrandingSectionProps) {
    return (
        <SettingsSection
            title="Application Branding"
            icon={Palette}
            description="Customize the application name and icon displayed throughout the dashboard."
        >
            <div className="space-y-4">
                <Input
                    label="Application Name"
                    value={applicationName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setApplicationName(e.target.value)}
                    maxLength={50}
                    placeholder="Framerr"
                    helperText={`${applicationName.length}/50 characters`}
                />
                <div>
                    <label className="block mb-2 font-medium text-theme-secondary text-sm">
                        Application Icon
                    </label>
                    <IconPicker
                        value={applicationIcon}
                        onChange={(icon: string) => setApplicationIcon(icon)}
                    />
                </div>
                <Button
                    onClick={handleSaveApplicationName}
                    disabled={!hasAppNameChanges || savingAppName}
                    icon={Save}
                    size="md"
                    textSize="sm"
                >
                    {savingAppName ? 'Saving...' : 'Save Application Name & Icon'}
                </Button>
            </div>
        </SettingsSection>
    );
}


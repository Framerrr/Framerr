/**
 * BackupInfoSection - What's included in a backup
 * Static info section showing backup contents
 */

import React from 'react';
import { Check } from 'lucide-react';
import { SettingsSection } from '../../../shared/ui/settings';

export const BackupInfoSection = (): React.JSX.Element => {
    return (
        <SettingsSection title="What's included in a backup?" noAnimation>
            <ul className="text-theme-secondary text-sm space-y-2">
                <li className="flex items-center gap-2">
                    <Check size={14} className="text-success" />
                    Database (users, settings, dashboards, widgets, integrations)
                </li>
                <li className="flex items-center gap-2">
                    <Check size={14} className="text-success" />
                    Profile pictures
                </li>
                <li className="flex items-center gap-2">
                    <Check size={14} className="text-success" />
                    Custom uploaded icons
                </li>
                <li className="flex items-center gap-2">
                    <Check size={14} className="text-success" />
                    Custom favicon
                </li>
            </ul>
        </SettingsSection>
    );
};

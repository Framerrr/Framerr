/**
 * Flatten UI Section Component
 * 
 * Toggle for enabling/disabling flat design mode.
 */

import React from 'react';
import { Layers } from 'lucide-react';
import { Switch } from '../../../shared/ui';
import { SettingsSection, SettingsItem } from '../../../shared/ui/settings';

interface FlattenUISectionProps {
    flattenUI: boolean;
    savingFlattenUI: boolean;
    handleToggleFlattenUI: (value: boolean) => Promise<void>;
}

export function FlattenUISection({
    flattenUI,
    savingFlattenUI,
    handleToggleFlattenUI,
}: FlattenUISectionProps) {
    return (
        <SettingsSection
            title="Flatten UI Design"
            icon={Layers}
            description="Remove glassmorphism effects, shadows, and backdrop blur for a minimal flat design aesthetic. This affects all cards and panels throughout the application."
        >
            <SettingsItem
                label="Flatten UI Design"
                description={flattenUI ? 'Flat design enabled' : '3D glassmorphism enabled'}
            >
                <Switch
                    checked={flattenUI}
                    onCheckedChange={handleToggleFlattenUI}
                    disabled={savingFlattenUI}
                />
            </SettingsItem>
        </SettingsSection>
    );
}


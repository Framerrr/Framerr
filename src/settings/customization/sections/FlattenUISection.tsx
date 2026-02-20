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
            title="Reduce Transparency"
            icon={Layers}
            description="Replace glass effects with solid backgrounds. Removes blur, transparency, and backdrop effects for a cleaner look."
        >
            <SettingsItem
                label="Reduce Transparency"
                description={flattenUI ? 'Solid backgrounds enabled' : 'Glass effects enabled'}
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


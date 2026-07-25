/**
 * ActionsSection - Template action buttons
 */

import React from 'react';
import { Plus, Save, Layout, Upload } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { SettingsSection } from '../../../shared/ui/settings';

interface ActionsSectionProps {
    isMobile: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onCreateNew: () => void;
    onSaveCurrent: () => void;
    onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ActionsSection: React.FC<ActionsSectionProps> = ({
    isMobile,
    fileInputRef,
    onCreateNew,
    onSaveCurrent,
    onImportFile,
}) => {
    return (
        <SettingsSection title="Template Actions" icon={Layout}>

            {!isMobile && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                        variant="secondary"
                        onClick={onCreateNew}
                        className="flex items-center justify-center gap-2 w-full py-8"
                    >
                        <Plus size={16} />
                        Create New Template
                    </Button>

                    <Button
                        variant="secondary"
                        onClick={onSaveCurrent}
                        className="flex items-center justify-center gap-2 w-full py-8"
                    >
                        <Save size={16} />
                        Save Current Dashboard
                    </Button>

                    <Button
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 w-full py-8"
                    >
                        <Upload size={16} />
                        Import Template
                    </Button>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept=".framerr"
                onChange={onImportFile}
                className="hidden"
            />

            {isMobile && (
                <p className="text-sm text-theme-tertiary italic">
                    Template creation and editing is only available on desktop.
                </p>
            )}
        </SettingsSection>
    );
};

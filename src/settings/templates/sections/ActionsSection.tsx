/**
 * ActionsSection - Template action buttons
 * 
 * Displays:
 * - Create New Template button
 * - Save Current Dashboard button
 * - Import Template button
 * - Revert to Previous Dashboard button (if backup exists)
 */

import React from 'react';
import { Plus, Save, Layout, RotateCcw, Upload } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { SettingsSection } from '../../../shared/ui/settings';

interface ActionsSectionProps {
    isMobile: boolean;
    hasBackup: boolean;
    reverting: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onCreateNew: () => void;
    onSaveCurrent: () => void;
    onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRevert: () => void;
}

export const ActionsSection: React.FC<ActionsSectionProps> = ({
    isMobile,
    hasBackup,
    reverting,
    fileInputRef,
    onCreateNew,
    onSaveCurrent,
    onImportFile,
    onRevert,
}) => {
    return (
        <SettingsSection title="Template Actions" icon={Layout}>

            {/* Desktop only: Template creation buttons */}
            {!isMobile && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Create New Template */}
                    <Button
                        variant="secondary"
                        onClick={onCreateNew}
                        className="flex items-center justify-center gap-2 w-full py-8"
                    >
                        <Plus size={16} />
                        Create New Template
                    </Button>

                    {/* Save Current Dashboard */}
                    <Button
                        variant="secondary"
                        onClick={onSaveCurrent}
                        className="flex items-center justify-center gap-2 w-full py-8"
                    >
                        <Save size={16} />
                        Save Current Dashboard
                    </Button>

                    {/* Import Template */}
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

            {/* Hidden file input for import */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".framerr"
                onChange={onImportFile}
                className="hidden"
            />

            {/* Mobile: Show info message instead */}
            {isMobile && (
                <p className="text-sm text-theme-tertiary italic">
                    Template creation and editing is only available on desktop.
                </p>
            )}

            {/* Revert Button */}
            {hasBackup && (
                <div className="mt-4 pt-4 border-t border-theme">
                    <Button
                        variant="secondary"
                        onClick={onRevert}
                        disabled={reverting}
                        className="flex items-center gap-2 w-full justify-center py-8"
                    >
                        <RotateCcw size={16} className={reverting ? 'animate-spin' : ''} />
                        {reverting ? 'Reverting...' : 'Revert to Previous Dashboard'}
                    </Button>
                    <p className="text-xs text-theme-tertiary text-center mt-2">
                        Restore the dashboard you had before applying a template.
                    </p>
                </div>
            )}
        </SettingsSection>
    );
};

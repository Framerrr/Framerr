/**
 * ActionsSection - Template action buttons
 *
 * Labels shorten via per-button @container queries when cells are tight:
 *   Create New Template → Create New
 *   Save Current Dashboard → Save Current
 *   Import Template → Import
 * Never icon-only.
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
                        className="@container flex items-center justify-center gap-2 w-full min-w-0 py-8"
                    >
                        <Plus size={16} className="shrink-0" />
                        <span className="min-w-0 truncate">
                            <span className="@[11rem]:hidden">Create New</span>
                            <span className="hidden @[11rem]:inline">Create New Template</span>
                        </span>
                    </Button>

                    <Button
                        variant="secondary"
                        onClick={onSaveCurrent}
                        className="@container flex items-center justify-center gap-2 w-full min-w-0 py-8"
                    >
                        <Save size={16} className="shrink-0" />
                        <span className="min-w-0 truncate">
                            <span className="@[11rem]:hidden">Save Current</span>
                            <span className="hidden @[11rem]:inline">Save Current Dashboard</span>
                        </span>
                    </Button>

                    <Button
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        className="@container flex items-center justify-center gap-2 w-full min-w-0 py-8"
                    >
                        <Upload size={16} className="shrink-0" />
                        <span className="min-w-0 truncate">
                            <span className="@[11rem]:hidden">Import</span>
                            <span className="hidden @[11rem]:inline">Import Template</span>
                        </span>
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

/**
 * CreateBackupSection - Manual backup creation
 * Shows create button and progress bar during backup
 */

import React from 'react';
import { Archive, Loader2 } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { SettingsSection } from '../../../shared/ui/settings';
import type { BackupProgress } from '../types';

interface CreateBackupSectionProps {
    isCreating: boolean;
    progress: BackupProgress | null;
    onCreateBackup: () => void;
}

export const CreateBackupSection = ({
    isCreating,
    progress,
    onCreateBackup
}: CreateBackupSectionProps): React.JSX.Element => {
    return (
        <SettingsSection
            title="Create Manual Backup"
            headerRight={
                <Button
                    onClick={onCreateBackup}
                    disabled={isCreating}
                    variant="primary"
                    size="sm"
                    icon={isCreating ? Loader2 : Archive}
                    className={isCreating ? 'animate-pulse' : ''}
                >
                    {isCreating ? 'Creating...' : 'Create Backup'}
                </Button>
            }
        >
            {/* Progress Bar */}
            {progress && (
                <div className="bg-theme-tertiary rounded-lg border border-theme p-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-theme-secondary">{progress.step}</span>
                        <span className="text-theme-primary font-medium">{progress.percent}%</span>
                    </div>
                    <div className="h-2 bg-theme-secondary/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-accent transition-all duration-300 ease-out"
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>
                </div>
            )}
        </SettingsSection>
    );
};

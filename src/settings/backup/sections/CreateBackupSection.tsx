/**
 * CreateBackupSection - Manual backup creation
 * Shows create button and progress bar during backup
 */

import React from 'react';
import { Archive, Loader2 } from 'lucide-react';
import { Button } from '../../../shared/ui';
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
        <div className="glass-subtle rounded-xl border border-theme-light overflow-hidden">
            {/* Header row — compact, vertically centered */}
            <div className="flex items-center justify-between px-6 py-4">
                <div>
                    <h3 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                        <Archive size={20} />
                        Create Manual Backup
                    </h3>
                </div>
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
            </div>

            {/* Progress Bar — only when active */}
            {progress && (
                <div className="px-6 pb-4">
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
                </div>
            )}
        </div>
    );
};

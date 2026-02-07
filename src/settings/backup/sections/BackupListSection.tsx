/**
 * BackupListSection - List of saved backups
 * Shows backup files with download and delete actions
 */

import React from 'react';
import { Archive, Download, Loader2 } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { ConfirmButton } from '../../../shared/ui';
import { SettingsSection, EmptyState } from '../../../shared/ui/settings';
import type { BackupInfo } from '../types';
import { formatBytes, formatDate, formatDateShort, getTypeIcon, getTypeLabel } from '../utils';

interface BackupListSectionProps {
    backups: BackupInfo[];
    isLoading: boolean;
    deletingFile: string | null;
    onDelete: (filename: string) => void;
    onDownload: (filename: string) => void;
}

export const BackupListSection = ({
    backups,
    isLoading,
    deletingFile,
    onDelete,
    onDownload
}: BackupListSectionProps): React.JSX.Element => {
    return (
        <SettingsSection title="Saved Backups" noAnimation>
            {isLoading ? (
                <div className="p-8 text-center text-theme-secondary">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    Loading backups...
                </div>
            ) : backups.length === 0 ? (
                <EmptyState
                    icon={Archive}
                    message="No backups yet. Create your first backup above."
                />
            ) : (
                <div className="space-y-2">
                    {backups.map((backup) => {
                        const TypeIcon = getTypeIcon(backup.type);
                        const isDeleting = deletingFile === backup.filename;
                        const isSafety = backup.type === 'safety';

                        return (
                            <div
                                key={backup.filename}
                                className="bg-theme-tertiary rounded-lg border border-theme p-4 flex items-center gap-4"
                            >
                                {/* Type Icon */}
                                <div className={`p-2 rounded-lg ${isSafety ? 'bg-warning/20' : 'bg-theme-secondary/20'
                                    }`}>
                                    <TypeIcon size={18} className={
                                        isSafety ? 'text-warning' : 'text-accent'
                                    } />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-theme-primary font-medium truncate">
                                        {backup.filename}
                                    </p>
                                    <div className="flex items-center gap-3 text-sm text-theme-secondary">
                                        <span>{getTypeLabel(backup.type)}</span>
                                        <span>•</span>
                                        <span className="hidden sm:inline">{formatDate(backup.createdAt)}</span>
                                        <span className="sm:hidden">{formatDateShort(backup.createdAt)}</span>
                                        <span>•</span>
                                        <span>{formatBytes(backup.size)}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                    {/* Download - responsive */}
                                    <div className="hidden sm:block">
                                        <Button
                                            onClick={() => onDownload(backup.filename)}
                                            variant="ghost"
                                            size="sm"
                                            icon={Download}
                                        >
                                            Download
                                        </Button>
                                    </div>
                                    <button
                                        onClick={() => onDownload(backup.filename)}
                                        className="sm:hidden p-2 text-theme-secondary hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                                        title="Download"
                                    >
                                        <Download size={18} />
                                    </button>

                                    {/* Delete with ConfirmButton */}
                                    {!isSafety && (
                                        <ConfirmButton
                                            onConfirm={() => onDelete(backup.filename)}
                                            label="Delete"
                                            size="sm"
                                            disabled={isDeleting}
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </SettingsSection>
    );
};

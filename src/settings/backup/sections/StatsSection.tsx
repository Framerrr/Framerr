/**
 * StatsSection - Backup statistics header
 * Shows backup count and total storage used
 */

import React from 'react';
import { Archive, HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { formatBytes } from '../utils';

interface StatsSectionProps {
    backupCount: number;
    totalSize: number;
    isLoading: boolean;
    onRefresh: () => void;
}

export const StatsSection = ({
    backupCount,
    totalSize,
    isLoading,
    onRefresh
}: StatsSectionProps): React.JSX.Element => {
    return (
        <div className="glass-subtle rounded-xl p-4 border border-theme flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-2 text-theme-secondary">
                <Archive size={18} className="text-accent" />
                <span className="font-medium text-theme-primary">{backupCount}</span>
                <span className="hidden sm:inline">Backups</span>
            </div>
            <div className="flex items-center gap-2 text-theme-secondary">
                <HardDrive size={18} className="text-accent" />
                <span className="font-medium text-theme-primary">{formatBytes(totalSize)}</span>
                <span className="hidden sm:inline">Total Size</span>
            </div>
            <div className="ml-auto">
                <div className="hidden sm:block">
                    <Button
                        onClick={onRefresh}
                        variant="ghost"
                        size="sm"
                        icon={RefreshCw}
                        disabled={isLoading}
                    >
                        Refresh
                    </Button>
                </div>
                <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="block sm:hidden p-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded-lg transition-colors"
                >
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>
        </div>
    );
};

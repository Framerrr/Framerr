/**
 * JobsSection - Background jobs table with run controls
 * 
 * Shows all registered cron jobs with schedule, next execution, and run now button.
 */

import React from 'react';
import { Clock, Play, Loader2 } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { SettingsSection } from '../../../shared/ui/settings';
import type { JobStatus } from '../types';

interface JobsSectionProps {
    jobs: JobStatus[];
    isLoading: boolean;
    triggeringJobId: string | null;
    onTriggerJob: (jobId: string) => void;
}

/** Format a relative time like "23 min" from an ISO date */
function formatNextRun(nextRun: string | null): string {
    if (!nextRun) return '—';

    const now = Date.now();
    const target = new Date(nextRun).getTime();
    const diffMs = target - now;

    if (diffMs < 0) return 'overdue';
    if (diffMs < 60000) return `${Math.ceil(diffMs / 1000)}s`;
    if (diffMs < 3600000) return `${Math.round(diffMs / 60000)} min`;
    if (diffMs < 86400000) return `${Math.round(diffMs / 3600000)}h`;
    return 'tomorrow';
}

export const JobsSection: React.FC<JobsSectionProps> = ({
    jobs,
    isLoading,
    triggeringJobId,
    onTriggerJob,
}) => {
    if (isLoading) {
        return (
            <SettingsSection title="Background Jobs" icon={Clock}>
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-theme-secondary" />
                </div>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection
            title="Background Jobs"
            icon={Clock}
            description="Scheduled tasks that run automatically in the background"
        >
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-theme-light">
                            <th className="text-center py-2 px-3 text-theme-secondary font-medium">Job</th>
                            <th className="text-center py-2 px-3 text-theme-secondary font-medium hidden md:table-cell">Schedule</th>
                            <th className="text-center py-2 px-3 text-theme-secondary font-medium">Next Run</th>
                            <th className="text-center py-2 px-3 text-theme-secondary font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.map((job) => {
                            const isTriggering = triggeringJobId === job.id;
                            const isRunning = job.status === 'running';

                            return (
                                <tr key={job.id} className="border-b border-theme-light last:border-b-0">
                                    <td className="py-3 px-3">
                                        <div className="font-medium text-theme-primary">{job.name}</div>
                                        <div className="text-xs text-theme-tertiary">{job.description}</div>
                                    </td>
                                    <td className="py-3 px-3 text-center text-theme-secondary font-mono text-xs hidden md:table-cell">
                                        {job.cronExpression}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isRunning
                                            ? 'bg-accent/20 text-accent'
                                            : 'bg-theme-hover text-theme-secondary'
                                            }`}>
                                            {isRunning ? (
                                                <>
                                                    <Loader2 size={10} className="animate-spin" />
                                                    Running
                                                </>
                                            ) : (
                                                formatNextRun(job.nextRun)
                                            )}
                                        </span>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon={Play}
                                            loading={isTriggering}
                                            disabled={isRunning}
                                            onClick={() => onTriggerJob(job.id)}
                                            className="text-accent bg-accent/10 hover:bg-accent/20"
                                        >
                                            Run
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {jobs.length === 0 && (
                <p className="text-center text-theme-tertiary py-4">No background jobs registered</p>
            )}
        </SettingsSection>
    );
};

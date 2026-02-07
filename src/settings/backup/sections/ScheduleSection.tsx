/**
 * ScheduleSection - Scheduled backup configuration
 * Enable/disable, frequency, day, time, max backups
 */

import React from 'react';
import { Settings, Check, Calendar, Loader2 } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { Select, Switch } from '../../../shared/ui';
import { SettingsSection } from '../../../shared/ui/settings';
import { DAYS_OF_WEEK } from '../types';
import type { ScheduleConfig } from '../types';
import { formatDate, formatTime } from '../utils';

interface ScheduleSectionProps {
    schedule: ScheduleConfig;
    nextBackupTime: string | null;
    isSavingSchedule: boolean;
    scheduleChanged: boolean;
    onSaveSchedule: () => void;
    onToggleSchedule: () => void;
    onUpdateSchedule: (updates: Partial<ScheduleConfig>) => void;
}

export const ScheduleSection = ({
    schedule,
    nextBackupTime,
    isSavingSchedule,
    scheduleChanged,
    onSaveSchedule,
    onToggleSchedule,
    onUpdateSchedule
}: ScheduleSectionProps): React.JSX.Element => {
    return (
        <SettingsSection
            title="Scheduled Backups"
            icon={Settings}
            headerRight={
                <Button
                    onClick={onSaveSchedule}
                    disabled={!scheduleChanged || isSavingSchedule}
                    variant="primary"
                    size="sm"
                    icon={isSavingSchedule ? Loader2 : Check}
                >
                    {isSavingSchedule ? 'Saving...' : 'Save Schedule'}
                </Button>
            }
        >
            {/* Enable Toggle - Level 4 styling */}
            <div className="bg-theme-tertiary rounded-lg border border-theme p-4 flex items-center justify-between">
                <div>
                    <p className="text-theme-primary font-medium">Enable Scheduled Backups</p>
                </div>
                <Switch
                    checked={schedule.enabled}
                    onCheckedChange={onToggleSchedule}
                />
            </div>

            {schedule.enabled && (
                <>
                    {/* Frequency */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-theme-secondary mb-2">Frequency</label>
                            <Select value={schedule.frequency} onValueChange={(value) => onUpdateSchedule({ frequency: value as 'daily' | 'weekly' })}>
                                <Select.Trigger className="w-full">
                                    <Select.Value placeholder="Select frequency" />
                                </Select.Trigger>
                                <Select.Content>
                                    <Select.Item value="daily">Daily</Select.Item>
                                    <Select.Item value="weekly">Weekly</Select.Item>
                                </Select.Content>
                            </Select>
                        </div>

                        {schedule.frequency === 'weekly' && (
                            <div>
                                <label className="block text-sm font-medium text-theme-secondary mb-2">Day</label>
                                <Select value={String(schedule.dayOfWeek ?? 0)} onValueChange={(value) => onUpdateSchedule({ dayOfWeek: parseInt(value) })}>
                                    <Select.Trigger className="w-full">
                                        <Select.Value placeholder="Select day" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        {DAYS_OF_WEEK.map((day, i) => (
                                            <Select.Item key={i} value={String(i)}>{day}</Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-theme-secondary mb-2">Time</label>
                            <Select value={String(schedule.hour)} onValueChange={(value) => onUpdateSchedule({ hour: parseInt(value) })}>
                                <Select.Trigger className="w-full">
                                    <Select.Value placeholder="Select time" />
                                </Select.Trigger>
                                <Select.Content>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <Select.Item key={i} value={String(i)}>{formatTime(i)}</Select.Item>
                                    ))}
                                </Select.Content>
                            </Select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-theme-secondary mb-2">Keep Backups</label>
                            <Select value={String(schedule.maxBackups)} onValueChange={(value) => onUpdateSchedule({ maxBackups: parseInt(value) })}>
                                <Select.Trigger className="w-full">
                                    <Select.Value placeholder="Select count" />
                                </Select.Trigger>
                                <Select.Content>
                                    {Array.from({ length: 10 }, (_, i) => (
                                        <Select.Item key={i + 1} value={String(i + 1)}>{`${i + 1} backup${i > 0 ? 's' : ''}`}</Select.Item>
                                    ))}
                                </Select.Content>
                            </Select>
                        </div>
                    </div>

                    {/* Status info */}
                    <div className="flex items-center gap-4 text-sm pt-2">
                        {schedule.lastBackup && (
                            <div className="flex items-center gap-1 text-theme-secondary">
                                <Check size={14} className="text-success" />
                                Last: {formatDate(schedule.lastBackup)}
                            </div>
                        )}
                        {nextBackupTime && (
                            <div className="flex items-center gap-1 text-theme-secondary">
                                <Calendar size={14} className="text-accent" />
                                Next: {formatDate(nextBackupTime)}
                            </div>
                        )}
                    </div>
                </>
            )}
        </SettingsSection>
    );
};

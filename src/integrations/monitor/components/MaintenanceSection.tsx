/**
 * MaintenanceSection - Scheduled maintenance configuration UI
 * Supports daily, weekly (day selection), and monthly (calendar grid) frequencies
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Checkbox, Select } from '@/shared/ui';
import { MaintenanceSectionProps, MaintenanceSchedule } from '../types';

const DEFAULT_SCHEDULE: MaintenanceSchedule = {
    enabled: false,
    frequency: 'daily',
    startTime: '02:00',
    endTime: '04:00'
};

const MaintenanceSection: React.FC<MaintenanceSectionProps> = ({
    schedule,
    onChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const currentSchedule = schedule || DEFAULT_SCHEDULE;

    const handleChange = (updates: Partial<MaintenanceSchedule>) => {
        onChange({ ...currentSchedule, ...updates });
    };

    return (
        <>
            {/* Section toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-sm text-theme-secondary hover:text-theme-primary transition-colors"
            >
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <Calendar size={16} />
                Maintenance Schedule
                {currentSchedule.enabled && (
                    <span className="text-xs bg-theme-tertiary px-2 py-0.5 rounded-full">Active</span>
                )}
            </button>

            {/* Section content */}
            {isOpen && (
                <div className="space-y-3 pl-4 border-l-2 border-theme">
                    {/* Enable toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                            checked={currentSchedule.enabled}
                            onCheckedChange={(checked) => handleChange({ enabled: checked === true })}
                        />
                        <span className="text-sm text-theme-primary">Enable scheduled maintenance</span>
                    </label>

                    {currentSchedule.enabled && (
                        <>
                            {/* Frequency dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-theme-primary mb-2">Frequency</label>
                                <Select value={currentSchedule.frequency} onValueChange={(value: string) => {
                                    const freq = value as 'daily' | 'weekly' | 'monthly';
                                    handleChange({
                                        frequency: freq,
                                        weeklyDays: freq === 'weekly' ? (currentSchedule.weeklyDays || [0]) : undefined,
                                        monthlyDay: freq === 'monthly' ? (currentSchedule.monthlyDay || 1) : undefined
                                    });
                                }}>
                                    <Select.Trigger className="w-full">
                                        <Select.Value placeholder="Select frequency" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        <Select.Item value="daily">Daily</Select.Item>
                                        <Select.Item value="weekly">Weekly</Select.Item>
                                        <Select.Item value="monthly">Monthly</Select.Item>
                                    </Select.Content>
                                </Select>
                            </div>

                            {/* Time range */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-theme-primary mb-1">Start Time</label>
                                    <input
                                        type="time"
                                        value={currentSchedule.startTime}
                                        onChange={(e) => handleChange({ startTime: e.target.value })}
                                        className="w-full px-3 py-2 bg-theme-primary border border-theme rounded-lg text-theme-primary text-sm focus:border-accent focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-theme-primary mb-1">End Time</label>
                                    <input
                                        type="time"
                                        value={currentSchedule.endTime}
                                        onChange={(e) => handleChange({ endTime: e.target.value })}
                                        className="w-full px-3 py-2 bg-theme-primary border border-theme rounded-lg text-theme-primary text-sm focus:border-accent focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Weekly day selection */}
                            {currentSchedule.frequency === 'weekly' && (
                                <div>
                                    <label className="block text-sm font-medium text-theme-primary mb-2">Days</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                                            const isSelected = currentSchedule.weeklyDays?.includes(idx) ?? false;
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => {
                                                        const days = currentSchedule.weeklyDays || [];
                                                        const newDays = isSelected
                                                            ? days.filter(d => d !== idx)
                                                            : [...days, idx];
                                                        handleChange({ weeklyDays: newDays });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isSelected
                                                        ? 'bg-accent text-white'
                                                        : 'bg-theme-tertiary text-theme-secondary hover:text-theme-primary'
                                                        }`}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Monthly day calendar grid */}
                            {currentSchedule.frequency === 'monthly' && (
                                <div>
                                    <label className="block text-sm font-medium text-theme-primary mb-2">Day of Month</label>
                                    <div className="grid grid-cols-7 gap-1">
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                                            const isSelected = currentSchedule.monthlyDay === day;
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => handleChange({ monthlyDay: day })}
                                                    className={`w-8 h-8 rounded text-sm font-medium transition-colors ${isSelected
                                                        ? 'bg-accent text-white'
                                                        : 'bg-theme-tertiary text-theme-secondary hover:text-theme-primary hover:bg-theme-hover'
                                                        }`}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-theme-tertiary mt-1">
                                        If day doesn't exist in month, runs on last day
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export default MaintenanceSection;

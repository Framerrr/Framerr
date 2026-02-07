/**
 * MonitorCard - Expandable card for service monitor display and editing
 * Collapsed: Shows status dot, icon, name, response time, share badge, chevron
 * Expanded: Full editing form with icon picker, fields, type selector, actions
 */

import React, { useRef, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Input } from '../../components/common/Input';
import CardHeader from './components/CardHeader';
import MaintenanceSection from './components/MaintenanceSection';
import AdvancedSection from './components/AdvancedSection';
import ActionBar from './components/ActionBar';
import { MonitorCardProps, MonitorType, MaintenanceSchedule } from './types';

const MonitorCard: React.FC<MonitorCardProps> = ({
    monitor,
    isExpanded,
    isNew = false,
    isReadonly = false,
    onToggleExpand,
    onChange,
    onDelete,
    onTest,
    testState,
    eligibleUsers = [],
    sharedUserIds = [],
    onShareChange
}) => {
    const cardRef = useRef<HTMLDivElement>(null);

    // Scroll card into view when expanded
    useEffect(() => {
        if (isExpanded && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [isExpanded]);

    return (
        <div ref={cardRef} className="border border-theme rounded-xl bg-theme-secondary overflow-hidden">
            {/* Collapsed Header - Always visible */}
            <CardHeader
                monitor={monitor}
                isNew={isNew}
                isExpanded={isExpanded}
                onToggleExpand={onToggleExpand}
                onIconChange={(iconName) => onChange('icon', iconName)}
            />

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-theme p-4 space-y-4 bg-theme-primary/30">
                    {/* Readonly banner for UK-imported monitors */}
                    {isReadonly && (
                        <div className="flex items-center gap-2 p-2 bg-theme-tertiary/30 rounded-lg text-xs text-theme-secondary">
                            <AlertCircle size={14} />
                            <span>Configuration managed in Uptime Kuma</span>
                        </div>
                    )}

                    {/* Name field - shown for all, but disabled for readonly */}
                    <div>
                        <Input
                            label="Name"
                            type="text"
                            value={monitor.name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('name', e.target.value)}
                            placeholder="My Service"
                            disabled={isReadonly}
                        />
                    </div>

                    {/* URL/Host/Type/Advanced - only for editable monitors */}
                    {!isReadonly && (
                        <>
                            {/* URL/Host based on type */}
                            {monitor.type === 'http' && (
                                <Input
                                    label="URL"
                                    type="text"
                                    value={monitor.url || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('url', e.target.value)}
                                    placeholder="http://192.168.1.100:8080"
                                />
                            )}
                            {monitor.type === 'tcp' && (
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <Input
                                            label="Host"
                                            type="text"
                                            value={monitor.host || ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('host', e.target.value)}
                                            placeholder="192.168.1.100"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <Input
                                            label="Port"
                                            type="text"
                                            value={monitor.port?.toString() || ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('port', parseInt(e.target.value) || 0)}
                                            placeholder="8080"
                                        />
                                    </div>
                                </div>
                            )}
                            {monitor.type === 'ping' && (
                                <Input
                                    label="Host"
                                    type="text"
                                    value={monitor.host || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('host', e.target.value)}
                                    placeholder="192.168.1.100 or example.com"
                                />
                            )}

                            {/* Type selector */}
                            <div>
                                <label className="block text-sm font-medium text-theme-primary mb-2">Type</label>
                                <div className="flex gap-4">
                                    {(['http', 'tcp', 'ping'] as MonitorType[]).map((type) => (
                                        <label key={type} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`monitor-type-${monitor.id}`}
                                                value={type}
                                                checked={monitor.type === type}
                                                onChange={() => onChange('type', type)}
                                                className="accent-[var(--accent)]"
                                            />
                                            <span className="text-sm text-theme-primary uppercase">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Maintenance Schedule section */}
                            <MaintenanceSection
                                schedule={monitor.maintenanceSchedule}
                                onChange={(schedule: MaintenanceSchedule) => onChange('maintenanceSchedule', schedule as unknown as boolean)}
                            />

                            {/* Advanced section */}
                            <AdvancedSection
                                monitor={monitor}
                                onChange={onChange}
                            />
                        </>
                    )}

                    {/* Action row */}
                    <ActionBar
                        monitor={monitor}
                        isNew={isNew}
                        isReadonly={isReadonly}
                        onDelete={onDelete}
                        onTest={onTest}
                        testState={testState}
                        eligibleUsers={eligibleUsers}
                        sharedUserIds={sharedUserIds}
                        onShareChange={onShareChange}
                    />

                    {/* Test result message */}
                    {testState?.message && !testState.loading && (
                        <p className={`text-sm ${testState.success ? 'text-success' : 'text-error'}`}>
                            {testState.message}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default MonitorCard;

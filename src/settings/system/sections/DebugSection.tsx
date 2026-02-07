/**
 * DebugSection - Developer tools and debugging options
 * 
 * Thin orchestrator using useDebugSettings hook.
 */

import React, { ChangeEvent } from 'react';
import { Download, Search, Bug, Play, Pause, FileText, ScrollText } from 'lucide-react';
import { Button, ConfirmButton } from '../../../shared/ui';
import { Switch, Select } from '@/shared/ui';
import { SettingsPage, SettingsSection } from '../../../shared/ui/settings';
import { useDebugSettings } from '../hooks/useDebugSettings';
import { LOG_LEVELS, FILTER_LEVELS } from '../types';
import type { FilterLevel } from '../types';

export function DebugSection(): React.JSX.Element {
    const {
        // Debug Overlay
        debugOverlay,
        handleOverlayToggle,

        // Log Level
        logLevel,
        handleLogLevelChange,

        // Logs
        logs,
        filteredLogs,
        loading,

        // Log Controls
        searchTerm,
        setSearchTerm,
        filterLevel,
        setFilterLevel,
        autoRefresh,
        setAutoRefresh,

        // Log Actions
        confirmClear,
        setConfirmClear,
        handleClearLogs,
        handleDownloadLogs,

        // Refs
        logsContainerRef,
        logsEndRef,

        // UI Helpers
        getLogLevelColor
    } = useDebugSettings();

    return (
        <SettingsPage
            title="Debug"
            description="Developer tools and debugging options"
        >
            {/* Debug Overlay Section */}
            <SettingsSection title="Debug Overlay" icon={Bug}>
                <div className="flex items-center justify-between p-4 rounded-lg bg-theme-tertiary border border-theme">
                    <div>
                        <h4 className="text-theme-primary font-medium">Dashboard Debug Overlay</h4>
                        <p className="text-theme-secondary text-sm mt-1">
                            Show grid layout and widget information on dashboard
                        </p>
                    </div>
                    <Switch
                        checked={debugOverlay}
                        onCheckedChange={handleOverlayToggle}
                    />
                </div>
            </SettingsSection>

            {/* Log Level Section */}
            <SettingsSection title="Log Level" icon={FileText}>
                <p className="text-theme-secondary text-sm mb-4">
                    Set minimum log level for system logging
                </p>
                <div className="flex flex-wrap gap-2">
                    {LOG_LEVELS.map(level => (
                        <button
                            key={level}
                            onClick={() => handleLogLevelChange(level)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${logLevel === level
                                ? 'bg-accent text-white'
                                : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-tertiary/80'
                                }`}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </SettingsSection>

            {/* Log Viewer Section */}
            <SettingsSection title="System Logs" icon={ScrollText}>
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-theme-primary font-medium">System Logs</h4>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            variant={autoRefresh ? 'primary' : 'secondary'}
                            icon={autoRefresh ? Play : Pause}
                            title={autoRefresh ? 'Auto-refresh ON (2s)' : 'Auto-refresh OFF'}
                            size="sm"
                            textSize="sm"
                        />
                        <Button
                            onClick={handleDownloadLogs}
                            variant="secondary"
                            icon={Download}
                            title="Download logs"
                            size="sm"
                            textSize="sm"
                        />
                        <ConfirmButton
                            onConfirm={handleClearLogs}
                            label="Clear"
                            confirmMode="icon"
                            size="sm"
                            textSize="sm"
                        />
                    </div>
                </div>

                {/* Search and Filter */}
                <div className="flex gap-2 mb-4">
                    <div className="flex-1 relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-tertiary">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-theme-tertiary text-theme-primary placeholder-theme-tertiary border border-theme rounded-lg focus:outline-none focus:ring-2 focus:border-accent focus:ring-accent/20"
                        />
                    </div>
                    <Select value={filterLevel} onValueChange={(value) => setFilterLevel(value as FilterLevel)}>
                        <Select.Trigger className="w-[140px] truncate">
                            <Select.Value placeholder="Filter" />
                        </Select.Trigger>
                        <Select.Content>
                            {FILTER_LEVELS.map(level => (
                                <Select.Item key={level} value={level}>{level}</Select.Item>
                            ))}
                        </Select.Content>
                    </Select>
                </div>

                {/* Logs Display */}
                <div ref={logsContainerRef} className="bg-theme-tertiary rounded-lg p-4 h-96 overflow-y-auto overflow-x-auto scroll-contain-x font-mono text-[10px] min-[515px]:text-xs sm:text-sm border border-theme">
                    {loading ? (
                        <div className="text-center text-theme-secondary py-8">Loading logs...</div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="text-center text-theme-secondary py-8">
                            {logs.length === 0 ? 'No logs available' : 'No matching logs'}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredLogs.map((log, index) => (
                                <div key={index} className="flex flex-wrap gap-0.5 min-[515px]:gap-1 sm:gap-2 hover:bg-theme-surface px-0.5 min-[515px]:px-1 sm:px-2 py-1 rounded min-w-0 transition-colors">
                                    <span className="text-theme-tertiary flex-shrink-0">
                                        {log.timestamp || new Date().toLocaleTimeString()}
                                    </span>
                                    <span className={`font-bold flex-shrink-0 ${getLogLevelColor(log.level)}`}>
                                        [{log.level || 'INFO'}]
                                    </span>
                                    <span className="text-theme-secondary break-words min-w-0 flex-1">
                                        {log.message || 'Log message'}
                                        {(() => {
                                            const sensitiveKeys = ['token', 'apikey', 'password', 'secret', 'authorization', 'credentials'];
                                            const metadataKeys = Object.keys(log).filter(
                                                key => !['timestamp', 'level', 'message'].includes(key)
                                            );
                                            if (metadataKeys.length === 0) return null;

                                            const displayMeta: Record<string, unknown> = {};
                                            let hasRedacted = false;

                                            for (const key of metadataKeys) {
                                                if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                                                    hasRedacted = true;
                                                } else {
                                                    displayMeta[key] = log[key];
                                                }
                                            }

                                            const parts: React.ReactNode[] = [];
                                            const metaEntries = Object.entries(displayMeta);
                                            if (metaEntries.length > 0) {
                                                parts.push(
                                                    <span key="meta" className="text-theme-tertiary ml-2">
                                                        {metaEntries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}
                                                    </span>
                                                );
                                            }
                                            if (hasRedacted) {
                                                parts.push(
                                                    <span key="redacted" className="text-warning/60 italic ml-2">
                                                        [+sensitive fields redacted]
                                                    </span>
                                                );
                                            }
                                            return parts;
                                        })()}
                                    </span>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>

                <div className="mt-4 text-sm text-theme-secondary text-center">
                    Showing {filteredLogs.length} of {logs.length} logs
                </div>
            </SettingsSection>
        </SettingsPage>
    );
}

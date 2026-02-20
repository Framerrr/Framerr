import React from 'react';
import { Server, Cpu, HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { SettingsSection } from '../../../shared/ui/settings';
import type { SystemInfo, Resources } from '../types';

interface InfoSectionProps {
    systemInfo: SystemInfo | null;
    resources: Resources | null;
    refreshing: boolean;
    onRefresh: () => Promise<void>;
    formatUptime: (seconds: number) => string;
}

/**
 * Format memory value in MB to a human-friendly string.
 * >= 1024 MB → show in GB (e.g., "18.3 GB"), otherwise MB (e.g., "512 MB").
 */
function formatMemory(mb: number): string {
    if (mb >= 1024) {
        return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
}

/**
 * InfoSection - System information and resource usage display
 * Uses SettingsSection for consistent L3 containers.
 */
export function InfoSection({
    systemInfo,
    resources,
    refreshing,
    onRefresh,
    formatUptime
}: InfoSectionProps): React.JSX.Element {
    return (
        <>
            {/* System Details */}
            <SettingsSection
                title="System Details"
                icon={Server}
                headerRight={
                    <Button
                        onClick={onRefresh}
                        disabled={refreshing}
                        variant="secondary"
                        icon={RefreshCw}
                        title="Refresh data"
                        className={refreshing ? '[&>svg]:animate-spin' : ''}
                    />
                }
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-theme-secondary text-sm">App Version</p>
                        <p className="text-theme-primary font-medium">{systemInfo?.appVersion || 'Unknown'}</p>
                    </div>
                    <div>
                        <p className="text-theme-secondary text-sm">Node.js Version</p>
                        <p className="text-theme-primary font-medium">{systemInfo?.nodeVersion || 'Unknown'}</p>
                    </div>
                    <div>
                        <p className="text-theme-secondary text-sm">Platform</p>
                        <p className="text-theme-primary font-medium">{systemInfo?.platform || 'Unknown'} ({systemInfo?.arch || 'Unknown'})</p>
                    </div>
                    <div>
                        <p className="text-theme-secondary text-sm">Uptime</p>
                        <p className="text-theme-primary font-medium">
                            {systemInfo?.uptime ? formatUptime(systemInfo.uptime) : 'Unknown'}
                        </p>
                    </div>
                </div>
            </SettingsSection>

            {/* Resource Usage */}
            <SettingsSection title="Resource Usage" icon={Cpu}>
                {/* Memory */}
                <div className="mb-6">
                    <div className="flex justify-between mb-2">
                        <span className="text-theme-secondary text-sm">Memory Usage</span>
                        <span className="text-theme-primary font-medium">
                            {formatMemory(resources?.memory?.used || 0)} / {formatMemory(resources?.memory?.total || 0)}
                        </span>
                    </div>
                    <div className="h-2 bg-theme-tertiary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-accent transition-all duration-300"
                            style={{
                                width: `${resources?.memory?.percentage || 0}%`
                            }}
                        />
                    </div>
                </div>

                {/* Memory Percentage */}
                <div>
                    <div className="flex justify-between mb-2">
                        <span className="text-theme-secondary text-sm flex items-center gap-2">
                            <HardDrive size={16} />
                            Memory Percentage
                        </span>
                        <span className="text-theme-primary font-medium">
                            {resources?.memory?.percentage?.toFixed(1) || 0}%
                        </span>
                    </div>
                    <p className="text-theme-tertiary text-xs">
                        Percentage of system memory in use
                    </p>
                </div>
            </SettingsSection>
        </>
    );
}

import React from 'react';
import { Server, Cpu, HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '../../../shared/ui';
import type { SystemInfo, Resources } from '../types';

interface InfoSectionProps {
    systemInfo: SystemInfo | null;
    resources: Resources | null;
    refreshing: boolean;
    onRefresh: () => Promise<void>;
    formatUptime: (seconds: number) => string;
}

/**
 * InfoSection - System information and resource usage display
 */
export function InfoSection({
    systemInfo,
    resources,
    refreshing,
    onRefresh,
    formatUptime
}: InfoSectionProps): React.JSX.Element {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pl-4 md:pl-2">
                <div>
                    <h3 className="text-xl font-bold text-theme-primary mb-1">System Information</h3>
                    <p className="text-theme-secondary text-sm">
                        View system details and resource usage
                    </p>
                </div>
                <Button
                    onClick={onRefresh}
                    disabled={refreshing}
                    variant="secondary"
                    icon={RefreshCw}
                    title="Refresh data"
                    className={refreshing ? '[&>svg]:animate-spin' : ''}
                />
            </div>

            {/* System Details */}
            <div className="glass-subtle rounded-xl shadow-medium p-6 border border-theme">
                <h4 className="text-theme-primary font-medium mb-4 flex items-center gap-2">
                    <Server size={18} className="text-accent" />
                    System Details
                </h4>
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
            </div>

            {/* Resource Usage */}
            <div className="glass-subtle rounded-xl shadow-medium p-6 border border-theme">
                <h4 className="text-theme-primary font-medium mb-4 flex items-center gap-2">
                    <Cpu size={18} className="text-accent" />
                    Resource Usage
                </h4>

                {/* Memory */}
                <div className="mb-6">
                    <div className="flex justify-between mb-2">
                        <span className="text-theme-secondary text-sm">Memory Usage</span>
                        <span className="text-theme-primary font-medium">
                            {resources?.memory?.used || 0} MB / {resources?.memory?.total || 0} MB
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
            </div>
        </div>
    );
}

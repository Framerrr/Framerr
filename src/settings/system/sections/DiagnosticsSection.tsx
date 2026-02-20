import React from 'react';
import { Activity, RefreshCw, Wifi, CheckCircle, XCircle, Database, Loader, Zap, Clock, Download, Upload } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { SettingsSection } from '../../../shared/ui/settings';
import type { SseStatus, DbStatus, SpeedTestState, ApiHealth, HealthStatus } from '../types';

interface DiagnosticsSectionProps {
    // Health Status
    sseStatus: SseStatus | null;
    healthLoading: boolean;
    onFetchHealthStatus: () => Promise<void>;

    // Database
    dbStatus: DbStatus | null;
    dbLoading: boolean;
    onTestDatabase: () => Promise<void>;

    // Speed Test
    speedTest: SpeedTestState;
    onRunSpeedTest: () => Promise<void>;

    // API Health
    apiHealth: ApiHealth | null;
    apiLoading: boolean;
    onTestApiHealth: () => Promise<void>;

    // Combined
    onRefreshDiagnostics: () => Promise<void>;

    // UI Helpers
    getStatusColor: (status: HealthStatus) => string;
}

/**
 * DiagnosticsSection - Health checks, database test, speed test, API health
 * Uses SettingsSection for consistent L3 containers.
 */
export function DiagnosticsSection({
    sseStatus,
    healthLoading,
    onFetchHealthStatus,
    dbStatus,
    dbLoading,
    onTestDatabase,
    speedTest,
    onRunSpeedTest,
    apiHealth,
    apiLoading,
    onTestApiHealth,
    onRefreshDiagnostics,
    getStatusColor
}: DiagnosticsSectionProps): React.JSX.Element {

    const getStatusIcon = (status: HealthStatus): React.JSX.Element => {
        if (status === 'healthy') return <CheckCircle size={18} className="text-success" />;
        if (status === 'error') return <XCircle size={18} className="text-error" />;
        return <Loader size={18} className="text-warning animate-spin" />;
    };

    return (
        <>
            {/* System Health - SSE & Integration Status */}
            <SettingsSection
                title="System Health"
                icon={Activity}
                headerRight={
                    <Button
                        onClick={onFetchHealthStatus}
                        disabled={healthLoading}
                        variant="secondary"
                    >
                        {healthLoading ? 'Checking...' : 'Refresh'}
                    </Button>
                }
            >
                {healthLoading && !sseStatus && (
                    <div className="flex items-center gap-2 text-theme-secondary">
                        <Loader size={16} className="animate-spin" />
                        <span>Loading health status...</span>
                    </div>
                )}

                {/* SSE Connection Status */}
                {sseStatus && (
                    <div className="flex items-center justify-between p-3 bg-theme-tertiary/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Wifi size={18} className={sseStatus.status === 'active' ? 'text-success' : 'text-warning'} />
                            <div>
                                <p className="text-theme-primary font-medium">Real-time Connection</p>
                                <p className="text-theme-secondary text-sm">
                                    {sseStatus.connectedClients} client{sseStatus.connectedClients !== 1 ? 's' : ''} connected
                                </p>
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${sseStatus.status === 'active' ? 'bg-success/20 text-success' :
                            sseStatus.status === 'idle' ? 'bg-warning/20 text-warning' :
                                'bg-error/20 text-error'
                            }`}>
                            {sseStatus.status}
                        </span>
                    </div>
                )}
            </SettingsSection>

            {/* Database Test */}
            <SettingsSection
                title="Database Connection"
                icon={Database}
                headerRight={
                    <Button
                        onClick={onTestDatabase}
                        disabled={dbLoading}
                        variant="secondary"
                    >
                        {dbLoading ? 'Testing...' : 'Test Database'}
                    </Button>
                }
            >
                {dbStatus && (
                    <div className="bg-theme-tertiary rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                            {getStatusIcon(dbStatus.status)}
                            <div>
                                <p className="text-theme-primary font-medium capitalize">{dbStatus.status}</p>
                                <p className="text-theme-secondary text-sm">
                                    Latency: {dbStatus.latency}ms
                                </p>
                            </div>
                        </div>
                        {dbStatus.details && (
                            <div className="text-sm text-theme-secondary space-y-1">
                                <p>Type: {dbStatus.details.type || 'Unknown'}</p>
                                <p>Path: {dbStatus.details.path}</p>
                                <p>Size: {dbStatus.details.sizeKB} KB</p>
                                {dbStatus.details.userCount !== undefined && (
                                    <p>Users: {dbStatus.details.userCount}</p>
                                )}
                                {dbStatus.details.tableCount !== undefined && (
                                    <p>Tables: {dbStatus.details.tableCount}</p>
                                )}
                            </div>
                        )}
                        {dbStatus.error && (
                            <p className="text-error text-sm mt-2">{dbStatus.error}</p>
                        )}
                    </div>
                )}
            </SettingsSection>

            {/* Speed Test */}
            <SettingsSection
                title="Network Speed Test"
                icon={Wifi}
                description="Test connection speed from your device to this server"
                headerRight={
                    <Button
                        onClick={onRunSpeedTest}
                        disabled={speedTest.running}
                        variant="secondary"
                    >
                        {speedTest.running ? 'Testing...' : 'Start Test'}
                    </Button>
                }
            >
                {speedTest.running && (
                    <div className="bg-theme-tertiary rounded-lg p-4">
                        <div className="flex items-center gap-3">
                            <Loader size={20} className="animate-spin text-accent" />
                            <p className="text-theme-primary">
                                {speedTest.stage === 'latency' && 'Measuring latency...'}
                                {speedTest.stage === 'download' && 'Testing download speed...'}
                                {speedTest.stage === 'upload' && 'Testing upload speed...'}
                            </p>
                        </div>
                    </div>
                )}

                {(speedTest.latency !== null || speedTest.download !== null || speedTest.upload !== null) && !speedTest.running && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Latency */}
                        <div className="bg-theme-tertiary rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock size={16} className="text-info" />
                                <span className="text-theme-secondary text-sm">Latency</span>
                            </div>
                            <p className="text-2xl font-bold text-theme-primary">{speedTest.latency} <span className="text-base text-theme-secondary">ms</span></p>
                            {speedTest.jitter !== null && (
                                <p className="text-xs text-theme-tertiary mt-1">
                                    Jitter: ±{speedTest.jitter}ms
                                </p>
                            )}
                        </div>

                        {/* Download */}
                        <div className="bg-theme-tertiary rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Download size={16} className="text-success" />
                                <span className="text-theme-secondary text-sm">Download</span>
                            </div>
                            <p className="text-2xl font-bold text-theme-primary">{speedTest.download} <span className="text-base text-theme-secondary">Mbps</span></p>
                        </div>

                        {/* Upload */}
                        <div className="bg-theme-tertiary rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Upload size={16} className="text-warning" />
                                <span className="text-theme-secondary text-sm">Upload</span>
                            </div>
                            <p className="text-2xl font-bold text-theme-primary">{speedTest.upload} <span className="text-base text-theme-secondary">Mbps</span></p>
                        </div>
                    </div>
                )}
            </SettingsSection>

            {/* API Health */}
            <SettingsSection
                title="API Health Checks"
                icon={Zap}
                headerRight={
                    <Button
                        onClick={onTestApiHealth}
                        disabled={apiLoading}
                        variant="secondary"
                    >
                        {apiLoading ? 'Testing...' : 'Refresh'}
                    </Button>
                }
            >
                {apiLoading && (
                    <div className="text-center py-8">
                        <Loader size={40} className="mx-auto mb-4 animate-spin text-accent" />
                        <p className="text-theme-secondary">Testing API endpoints...</p>
                    </div>
                )}

                {apiHealth && !apiLoading && (
                    <div className="space-y-3">
                        {/* Overall Status */}
                        <div className={`p-3 rounded-lg flex items-center gap-3 ${getStatusColor(apiHealth.overallStatus)}`}>
                            {getStatusIcon(apiHealth.overallStatus)}
                            <span className="font-medium capitalize">Overall: {apiHealth.overallStatus}</span>
                        </div>

                        {/* Individual Endpoints */}
                        {apiHealth.endpoints?.map((endpoint, index) => (
                            <div key={index} className="bg-theme-tertiary rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {getStatusIcon(endpoint.status)}
                                        <div>
                                            <p className="text-theme-primary font-medium">{endpoint.name}</p>
                                            <p className="text-theme-secondary text-sm">{endpoint.path}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(endpoint.status)}`}>
                                            {endpoint.status}
                                        </span>
                                        <p className="text-theme-secondary text-sm mt-1">{endpoint.responseTime}ms</p>
                                    </div>
                                </div>
                                {endpoint.error && (
                                    <p className="text-error text-sm mt-2">{endpoint.error}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </SettingsSection>
        </>
    );
}

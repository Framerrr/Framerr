import React from 'react';
import { RefreshCw } from 'lucide-react';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { useSystemSettings } from '../../system/hooks/useSystemSettings';
import { InfoSection } from '../../system/sections/InfoSection';
import { DiagnosticsSection } from '../../system/sections/DiagnosticsSection';
import { SettingsPage } from '../../../shared/ui/settings';

/**
 * SystemPage - System information and diagnostics (Admin only)
 * 
 * Thin orchestrator that composes InfoSection and DiagnosticsSection
 * inside a SettingsPage wrapper for consistent layout.
 */
export const SystemPage = (): React.JSX.Element => {
    const {
        // System Information
        systemInfo,
        resources,
        loading,
        refreshing,
        handleRefresh,
        formatUptime,

        // Health Status
        sseStatus,
        healthLoading,
        fetchHealthStatus,

        // Database
        dbStatus,
        dbLoading,
        testDatabase,

        // Speed Test
        speedTest,
        runSpeedTest,

        // API Health
        apiHealth,
        apiLoading,
        testApiHealth,

        // Combined
        handleRefreshDiagnostics,

        // UI Helpers
        getStatusColor
    } = useSystemSettings();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="lg" message="Loading system information..." />
            </div>
        );
    }

    return (
        <SettingsPage
            title="System"
            description="View system details, resource usage, and run diagnostics"
        >
            <InfoSection
                systemInfo={systemInfo}
                resources={resources}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                formatUptime={formatUptime}
            />

            <DiagnosticsSection
                sseStatus={sseStatus}
                healthLoading={healthLoading}
                onFetchHealthStatus={fetchHealthStatus}
                dbStatus={dbStatus}
                dbLoading={dbLoading}
                onTestDatabase={testDatabase}
                speedTest={speedTest}
                onRunSpeedTest={runSpeedTest}
                apiHealth={apiHealth}
                apiLoading={apiLoading}
                onTestApiHealth={testApiHealth}
                onRefreshDiagnostics={handleRefreshDiagnostics}
                getStatusColor={getStatusColor}
            />
        </SettingsPage>
    );
};

export default SystemPage;

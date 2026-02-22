/**
 * Monitor type definitions
 * Extracted from MonitorCard.tsx during Phase 1.5.1 refactor
 */

import { EligibleUser } from './MonitorSharingDropdown';

// Monitor types supported by the backend
export type MonitorType = 'http' | 'tcp' | 'ping';

// Monitor status states
export type MonitorStatus = 'up' | 'down' | 'degraded' | 'pending' | 'maintenance';

// Maintenance schedule configuration
export interface MaintenanceSchedule {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    startTime: string;    // "02:00" (24h format)
    endTime: string;      // "04:00" (24h format)
    weeklyDays?: number[]; // 0=Sun, 6=Sat
    monthlyDay?: number;   // 1-31
}

// Monitor data structure matching backend
export interface Monitor {
    id: string;
    name: string;
    url?: string;
    host?: string;
    port?: number;
    type: MonitorType;
    icon?: string;
    enabled: boolean;
    check_interval_seconds: number;
    timeout_seconds: number;
    retries_before_down: number;
    degraded_threshold_ms?: number;
    expected_status_codes?: string;
    maintenance_mode: boolean;
    // Uptime Kuma integration
    uptimeKumaId?: number | null;
    uptimeKumaUrl?: string | null;
    isReadonly?: boolean;
    // Runtime status (from poller)
    status?: MonitorStatus;
    response_time_ms?: number;
    last_check?: string;
    share_count?: number;
    // Scheduled maintenance
    maintenanceSchedule?: MaintenanceSchedule | null;
    // Source integration instance (for import dedup)
    integrationInstanceId?: string | null;
    sourceIntegrationId?: string | null;
}

// Default values for new monitors
export const DEFAULT_MONITOR: Omit<Monitor, 'id'> = {
    name: '',
    url: '',
    type: 'http',
    icon: 'Globe',
    enabled: true,
    check_interval_seconds: 60,
    timeout_seconds: 10,
    retries_before_down: 3,
    degraded_threshold_ms: 2000,
    expected_status_codes: '200-299',
    maintenance_mode: false,
    maintenanceSchedule: null
};

// Test state for connection testing
export interface TestState {
    loading?: boolean;
    success?: boolean;
    message?: string;
}

// Props for MonitorCard component
export interface MonitorCardProps {
    monitor: Monitor;
    isExpanded: boolean;
    isNew?: boolean;
    isReadonly?: boolean;
    onToggleExpand: () => void;
    onChange: (field: keyof Monitor, value: string | number | boolean | MaintenanceSchedule | null) => void;
    onDelete: () => void;
    onTest: () => Promise<void> | void;
    testState?: TestState | null;
    /** Users eligible for sharing (from integration sharing dirty state) */
    eligibleUsers?: EligibleUser[];
    /** Currently shared user IDs for this monitor */
    sharedUserIds?: string[];
    /** Callback when sharing changes (updates dirty state) */
    onShareChange?: (userIds: string[]) => void;
}

// Props for CardHeader component
export interface CardHeaderProps {
    monitor: Monitor;
    isNew: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onIconChange: (iconName: string) => void;
}

// Props for MaintenanceSection component
export interface MaintenanceSectionProps {
    schedule: MaintenanceSchedule | null | undefined;
    onChange: (schedule: MaintenanceSchedule) => void;
}

// Props for AdvancedSection component
export interface AdvancedSectionProps {
    monitor: Monitor;
    onChange: (field: keyof Monitor, value: string | number) => void;
}

// Props for ActionBar component
export interface ActionBarProps {
    monitor: Monitor;
    isNew: boolean;
    isReadonly: boolean;
    onDelete: () => void;
    onTest: () => Promise<void> | void;
    testState?: TestState | null;
    eligibleUsers?: EligibleUser[];
    sharedUserIds?: string[];
    onShareChange?: (userIds: string[]) => void;
}

// Props for MonitorForm component
export interface MonitorFormProps {
    /** Integration instance ID this form manages */
    instanceId: string;
    /** Available integrations for import dropdown */
    integrations?: Record<string, IntegrationConfig>;
    /** Called when form mounts so parent can access ref methods */
    onReady?: () => void;
    /** Called when monitor dirty state changes (new/edited/reordered monitors) */
    onDirtyChange?: (dirty: boolean) => void;
}

// Exposed methods for parent to call via ref
export interface MonitorFormRef {
    saveAll: () => Promise<void>;
    resetAll: () => void;
}

// Props for SortableMonitorItem wrapper
export interface SortableMonitorItemProps {
    id: string;
    children: React.ReactNode;
    isExpanded: boolean;
}

// Integration config type (from definitions.ts)
export interface IntegrationConfig {
    enabled?: boolean;
    url?: string;
    _type?: string;
    _displayName?: string;
    [key: string]: unknown;
}

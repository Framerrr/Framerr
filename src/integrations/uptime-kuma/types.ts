/**
 * Uptime Kuma integration types
 */

// Monitor data from Uptime Kuma /metrics endpoint
export interface UKMonitor {
    id: string;  // Monitor name (used as ID since /metrics doesn't expose numeric IDs)
    name: string;
    type: string;
    url?: string;
    active: boolean;
    latency?: number;
}

// Exposed methods for parent to call (for modal save/cancel)
export interface UptimeKumaFormRef {
    saveAll: () => Promise<void>;
    resetAll: () => void;
}

// Props for UptimeKumaForm component
export interface UptimeKumaFormProps {
    /** Integration instance ID this form manages */
    instanceId: string;
    /** Parent's integrations state (keyed by instanceId) */
    integrations: Record<string, unknown>;
    /** Callback to update integration config field */
    onFieldChange: (instanceId: string, field: string, value: string) => void;
    /** Called when form mounts so parent can access ref methods */
    onReady?: () => void;
}

/**
 * useFormRefs Hook
 * 
 * Manages monitor and UptimeKuma form refs, force-render state,
 * and delegated save/cancel/dirty handlers.
 * 
 * Extracted from useIntegrationSettings as a self-contained hook
 * with no external dependencies (no props needed).
 */

import { useRef, useState, useCallback } from 'react';
import type { MonitorFormRef } from '../../../integrations/monitor';
import type { UptimeKumaFormRef } from '../../../integrations/uptime-kuma';

export interface UseFormRefsReturn {
    monitorFormRef: React.RefObject<MonitorFormRef | null>;
    uptimeKumaFormRef: React.RefObject<UptimeKumaFormRef | null>;
    monitorDirty: boolean;
    handleMonitorFormReady: () => void;
    handleMonitorSave: () => Promise<void>;
    handleMonitorCancel: () => void;
    handleMonitorDirtyChange: (dirty: boolean) => void;
    handleUptimeKumaFormReady: () => void;
    handleUptimeKumaSave: () => Promise<void>;
    handleUptimeKumaCancel: () => void;
}

export function useFormRefs(): UseFormRefsReturn {
    // Monitor form ref for modal save/cancel
    const monitorFormRef = useRef<MonitorFormRef>(null);
    // UptimeKuma form ref for modal save/cancel
    const uptimeKumaFormRef = useRef<UptimeKumaFormRef>(null);
    // Force re-render when forms mount
    const [, setMonitorFormReady] = useState(0);
    const [, setUptimeKumaFormReady] = useState(0);
    // Track monitor form dirty state (new/edited/reordered monitors)
    const [monitorDirty, setMonitorDirty] = useState(false);

    const handleMonitorFormReady = useCallback(() => {
        setMonitorFormReady(prev => prev + 1);
    }, []);

    const handleUptimeKumaFormReady = useCallback(() => {
        setUptimeKumaFormReady(prev => prev + 1);
    }, []);

    const handleMonitorDirtyChange = useCallback((dirty: boolean) => {
        setMonitorDirty(dirty);
    }, []);

    const handleMonitorSave = useCallback(async (): Promise<void> => {
        await monitorFormRef.current?.saveAll();
    }, []);

    const handleMonitorCancel = useCallback((): void => {
        monitorFormRef.current?.resetAll();
    }, []);

    const handleUptimeKumaSave = useCallback(async (): Promise<void> => {
        await uptimeKumaFormRef.current?.saveAll();
    }, []);

    const handleUptimeKumaCancel = useCallback((): void => {
        uptimeKumaFormRef.current?.resetAll();
    }, []);

    return {
        monitorFormRef,
        uptimeKumaFormRef,
        monitorDirty,
        handleMonitorFormReady,
        handleMonitorSave,
        handleMonitorCancel,
        handleMonitorDirtyChange,
        handleUptimeKumaFormReady,
        handleUptimeKumaSave,
        handleUptimeKumaCancel,
    };
}

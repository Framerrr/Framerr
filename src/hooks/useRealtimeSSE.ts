/**
 * useRealtimeSSE Hook
 *
 * React hook façade for Framerr's SSE realtime system.
 * Uses singleton pattern - all components share one connection.
 *
 * This file is a thin wrapper around the connection engine at
 * src/features/realtime/. All imperative logic lives there.
 * This file provides React hooks and backward-compatible re-exports.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
    subscribeToStore,
    getSnapshot,
    subscribeToTopicInternal,
    serviceStatusCallbacks,
    backupCallbacks,
    notificationCallbacks,
    settingsInvalidateCallbacks,
    themeCallbacks,
    librarySyncProgressCallbacks,
} from '../features/realtime';
import type {
    ServiceStatusEvent,
    BackupEvent,
    NotificationEvent,
    SettingsInvalidateEvent,
    ThemeEvent,
    LibrarySyncProgressEvent,
    UseRealtimeSSEResult,
} from '../features/realtime';

// ============================================================================
// RE-EXPORTS (backward compatibility — all consumers keep existing imports)
// ============================================================================

// Re-export ALL types
export type {
    PlexSession,
    QueueItem,
    ServiceStatusEvent,
    BackupStartedEvent,
    BackupProgressEvent,
    BackupCompleteEvent,
    BackupErrorEvent,
    BackupScheduledFailedEvent,
    BackupEvent,
    ConnectionStatus,
    SSEConnectionState,
    NotificationEvent,
    SettingsInvalidateEvent,
    ThemeEvent,
    LibrarySyncProgressEvent,
    UseRealtimeSSEResult,
    RealtimeState,
} from '../features/realtime';

// Re-export ALL lifecycle/query functions
export {
    initializeSSE,
    disconnectSSE,
    retrySSEConnection,
    getSSEConnectionState,
    onSSEConnectionStateChange,
    getConnectionStatus,
    getDisconnectedAt,
} from '../features/realtime';

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Connect to Framerr SSE for real-time updates.
 * Uses singleton pattern - all components share one connection.
 */
export function useRealtimeSSE(): UseRealtimeSSEResult {
    const currentState = useSyncExternalStore(subscribeToStore, getSnapshot, getSnapshot);

    const onServiceStatus = useCallback((callback: (event: ServiceStatusEvent) => void) => {
        serviceStatusCallbacks.add(callback);
        return () => {
            serviceStatusCallbacks.delete(callback);
        };
    }, []);

    const onBackupEvent = useCallback((callback: (event: BackupEvent) => void) => {
        backupCallbacks.add(callback);
        return () => {
            backupCallbacks.delete(callback);
        };
    }, []);

    // Phase 7: Notification callback registration
    const onNotification = useCallback((callback: (event: NotificationEvent) => void) => {
        notificationCallbacks.add(callback);
        return () => {
            notificationCallbacks.delete(callback);
        };
    }, []);

    // Global settings invalidation callback registration
    const onSettingsInvalidate = useCallback((callback: (event: SettingsInvalidateEvent) => void) => {
        settingsInvalidateCallbacks.add(callback);
        return () => {
            settingsInvalidateCallbacks.delete(callback);
        };
    }, []);

    // Settings SSE: Theme callback registration for real-time theme sync
    const onThemeChange = useCallback((callback: (event: ThemeEvent) => void) => {
        themeCallbacks.add(callback);
        return () => {
            themeCallbacks.delete(callback);
        };
    }, []);

    // Library sync progress callback for smooth progress bar updates
    const onLibrarySyncProgress = useCallback((callback: (event: LibrarySyncProgressEvent) => void) => {
        librarySyncProgressCallbacks.add(callback);
        return () => {
            librarySyncProgressCallbacks.delete(callback);
        };
    }, []);

    return {
        isConnected: currentState.isConnected,
        connectionId: currentState.connectionId,
        disconnectedAt: currentState.disconnectedAt,
        subscribeToTopic: subscribeToTopicInternal,
        onServiceStatus,
        onBackupEvent,
        onNotification,
        onSettingsInvalidate,
        onThemeChange,
        onLibrarySyncProgress,
        // LEGACY: Empty stubs - widgets should migrate to subscribeToTopic in Phase 8
        plexSessions: [],
        sonarrQueue: [],
        radarrQueue: []
    };
}

/**
 * Hook for subscribing to a specific topic with automatic cleanup.
 * Returns the latest data for the topic.
 */
export function useTopicSubscription<T>(topic: string | null): T | null {
    const dataRef = useRef<T | null>(null);
    const { subscribeToTopic, connectionId } = useRealtimeSSE();

    useEffect(() => {
        if (!topic || !connectionId) {
            return;
        }

        let unsubscribe: (() => void) | null = null;

        subscribeToTopic(topic, (data) => {
            dataRef.current = data as T;
            // Force re-render by triggering state update
            // This is a simplified approach - in production might want to use a separate state
        }).then(unsub => {
            unsubscribe = unsub;
        });

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [topic, connectionId, subscribeToTopic]);

    return dataRef.current;
}

export default useRealtimeSSE;

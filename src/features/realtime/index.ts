/**
 * Realtime Feature Barrel
 *
 * Re-exports all types and engine functions for clean imports.
 */

export * from './types';
export {
    // Lifecycle API
    initializeSSE,
    disconnectSSE,
    retrySSEConnection,
    // State query
    getSSEConnectionState,
    onSSEConnectionStateChange,
    getConnectionStatus,
    getDisconnectedAt,
    // Store integration (for React hook)
    subscribeToStore,
    getSnapshot,
    subscribeToTopicInternal,
    // Callback sets (for React hook registration)
    serviceStatusCallbacks,
    backupCallbacks,
    notificationCallbacks,
    settingsInvalidateCallbacks,
    themeCallbacks,
    librarySyncProgressCallbacks,
} from './sseConnectionEngine';

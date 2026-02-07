/**
 * useConnectionToasts Hook
 * 
 * P9: Manages toast notifications for SSE connection state transitions.
 * Shows persistent toast during reconnection, auto-dismiss on success.
 */

import { useEffect, useRef } from 'react';
import { onSSEConnectionStateChange, SSEConnectionState, retrySSEConnection } from './useRealtimeSSE';
import { useNotifications } from '../context/NotificationContext';
import logger from '../utils/logger';

// Toast IDs for managing dismissal
const TOAST_ID_RECONNECTING = 'sse-reconnecting';
const TOAST_ID_RECONNECTED = 'sse-reconnected';
const TOAST_ID_FAILED = 'sse-connection-failed';

/**
 * Hook that shows toast notifications based on SSE connection state.
 * Must be mounted in a component inside NotificationProvider.
 * 
 * Toast behavior:
 * - Reconnecting: Persistent until success or failure
 * - Reconnected: 10 second auto-dismiss
 * - Connection Lost: Persistent (serious issue requiring attention)
 */
export function useConnectionToasts(): void {
    const { showToast, dismissToast } = useNotifications();
    const wasConnectedRef = useRef(false);
    const reconnectingToastShownRef = useRef(false);

    useEffect(() => {
        const unsubscribe = onSSEConnectionStateChange((newState: SSEConnectionState, oldState: SSEConnectionState) => {
            logger.debug('[ConnectionToasts] State transition', {
                from: oldState,
                to: newState
            });

            // Track if we were ever connected (to know if this is initial connect or reconnect)
            if (oldState === 'connected') {
                wasConnectedRef.current = true;
            }

            switch (newState) {
                case 'reconnecting':
                    // Only show if we were previously connected (not on initial connect attempt)
                    if (wasConnectedRef.current && !reconnectingToastShownRef.current) {
                        reconnectingToastShownRef.current = true;
                        showToast('warning', 'Reconnecting...', 'Connection lost. Attempting to reconnect.', {
                            id: TOAST_ID_RECONNECTING,
                            duration: 0 // Persistent
                        });
                    }
                    break;

                case 'connected':
                    // Dismiss reconnecting toast if shown
                    if (reconnectingToastShownRef.current) {
                        dismissToast(TOAST_ID_RECONNECTING);
                        reconnectingToastShownRef.current = false;

                        // Show success only if we were reconnecting
                        if (oldState === 'reconnecting') {
                            showToast('success', 'Reconnected', 'Connection restored.', {
                                id: TOAST_ID_RECONNECTED,
                                duration: 10000 // 10 seconds
                            });
                        }
                    }
                    break;

                case 'failed':
                    // Dismiss reconnecting toast and show failure
                    if (reconnectingToastShownRef.current) {
                        dismissToast(TOAST_ID_RECONNECTING);
                        reconnectingToastShownRef.current = false;
                    }

                    showToast('error', 'Connection Lost', 'Unable to connect to server. Click to retry.', {
                        id: TOAST_ID_FAILED,
                        duration: 0, // Persistent
                        onBodyClick: () => {
                            dismissToast(TOAST_ID_FAILED);
                            retrySSEConnection();
                        }
                    });
                    break;

                case 'idle':
                    // User logged out - clean up any toasts
                    dismissToast(TOAST_ID_RECONNECTING);
                    dismissToast(TOAST_ID_RECONNECTED);
                    dismissToast(TOAST_ID_FAILED);
                    reconnectingToastShownRef.current = false;
                    wasConnectedRef.current = false;
                    break;
            }
        });

        return () => {
            unsubscribe();
        };
    }, [showToast, dismissToast]);
}

export default useConnectionToasts;

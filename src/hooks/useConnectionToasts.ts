/**
 * useConnectionToasts Hook
 * 
 * P9: Manages toast notifications for SSE connection state transitions.
 * Shows persistent toast during reconnection, auto-dismiss on success.
 * 
 * Grace Period: When connection drops, we wait 10 seconds before showing
 * any toast. Quick reconnects (tab switch, brief network hiccup) are
 * completely invisible to the user. Only prolonged disconnections show toasts.
 */

import { useEffect, useRef } from 'react';
import { onSSEConnectionStateChange, SSEConnectionState, retrySSEConnection } from './useRealtimeSSE';
import { useNotifications } from '../context/NotificationContext';
import logger from '../utils/logger';

// Toast IDs for managing dismissal
const TOAST_ID_RECONNECTING = 'sse-reconnecting';
const TOAST_ID_RECONNECTED = 'sse-reconnected';
const TOAST_ID_FAILED = 'sse-connection-failed';

// Grace period before showing reconnection toasts (ms)
// Quick reconnects within this window are completely silent
const RECONNECT_GRACE_PERIOD_MS = 10000;

/**
 * Hook that shows toast notifications based on SSE connection state.
 * Must be mounted in a component inside NotificationProvider.
 * 
 * Toast behavior:
 * - Reconnecting (within grace period): SILENT - no toast
 * - Reconnecting (after grace period): Persistent until success or failure
 * - Reconnected (was silent): No toast at all
 * - Reconnected (after toast shown): 10 second auto-dismiss
 * - Connection Lost (during grace): Skip straight to failure toast
 * - Connection Lost (after toast): Replace reconnecting with failure
 */
export function useConnectionToasts(): void {
    const { showToast, dismissToast } = useNotifications();
    const wasConnectedRef = useRef(false);
    const reconnectingToastShownRef = useRef(false);
    const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                    // Only act if we were previously connected (not on initial connect attempt)
                    if (wasConnectedRef.current && !reconnectingToastShownRef.current) {
                        // Start grace period — don't show toast yet
                        if (!graceTimerRef.current) {
                            logger.debug('[ConnectionToasts] Grace period started (10s)');
                            graceTimerRef.current = setTimeout(() => {
                                graceTimerRef.current = null;
                                // Grace period expired and still not connected — show toast
                                reconnectingToastShownRef.current = true;
                                showToast('warning', 'Reconnecting...', 'Connection lost. Attempting to reconnect.', {
                                    id: TOAST_ID_RECONNECTING,
                                    duration: 0 // Persistent
                                });
                            }, RECONNECT_GRACE_PERIOD_MS);
                        }
                    }
                    break;

                case 'connected':
                    // Cancel grace timer if running (silent reconnect)
                    if (graceTimerRef.current) {
                        clearTimeout(graceTimerRef.current);
                        graceTimerRef.current = null;
                        logger.debug('[ConnectionToasts] Silent reconnect — no toasts');
                        // No toast at all — reconnected within grace period
                    }

                    // Dismiss reconnecting toast if it was shown (past grace period)
                    if (reconnectingToastShownRef.current) {
                        dismissToast(TOAST_ID_RECONNECTING);
                        reconnectingToastShownRef.current = false;

                        // Show success only if reconnecting toast was visible
                        if (oldState === 'reconnecting') {
                            showToast('success', 'Reconnected', 'Connection restored.', {
                                id: TOAST_ID_RECONNECTED,
                                duration: 10000 // 10 seconds
                            });
                        }
                    }
                    break;

                case 'failed':
                    // Cancel grace timer if running
                    if (graceTimerRef.current) {
                        clearTimeout(graceTimerRef.current);
                        graceTimerRef.current = null;
                    }

                    // Dismiss reconnecting toast if it was shown
                    if (reconnectingToastShownRef.current) {
                        dismissToast(TOAST_ID_RECONNECTING);
                        reconnectingToastShownRef.current = false;
                    }

                    // Show failure toast (always — this is a genuine problem)
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
                    // User logged out - clean up everything
                    if (graceTimerRef.current) {
                        clearTimeout(graceTimerRef.current);
                        graceTimerRef.current = null;
                    }
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
            // Clean up grace timer on unmount
            if (graceTimerRef.current) {
                clearTimeout(graceTimerRef.current);
                graceTimerRef.current = null;
            }
        };
    }, [showToast, dismissToast]);
}

export default useConnectionToasts;


/**
 * NotificationContext - Re-export from modular location
 * 
 * P3 Phase 3: Context split into focused sub-modules.
 * This file maintains backwards compatibility for existing imports.
 * 
 * For new code, prefer importing from:
 * - './notification' for full access
 * - './notification/ToastContext' for toast-only consumers
 * - './notification/NotificationCenterContext' for notification center consumers
 * - './notification/PushContext' for push notification consumers
 */

// Re-export everything from the new modular location
export * from './notification';

// Note: The NotificationContext export was removed as part of P3 Phase 3.
// The context is now internal to the module. Use useNotifications() hook instead.

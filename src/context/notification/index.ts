/**
 * Notification module - Public API
 * 
 * Main exports for the notification system.
 */

// Main provider and unified hook (backwards-compatible)
export { NotificationProvider, useNotifications } from './NotificationContext';

// Direct access to sub-contexts (for components that only need one concern)
export { useToasts, ToastProvider, type ToastContextValue } from './ToastContext';
export { useNotificationCenter, NotificationCenterProvider, type NotificationCenterContextValue } from './NotificationCenterContext';
export { usePush, PushProvider, type PushContextValue } from './PushContext';

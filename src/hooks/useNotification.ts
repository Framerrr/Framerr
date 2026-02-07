import { useNotifications } from '../context/NotificationContext';
import type { NotificationType, ToastOptions } from '../../shared/types/notification';

/**
 * Return type for useNotification hook
 */
export interface UseNotificationReturn {
    notify: (type: NotificationType, title: string, message: string, options?: ToastOptions) => string;
    success: (title: string, message: string, options?: ToastOptions) => string;
    error: (title: string, message: string, options?: ToastOptions) => string;
    warning: (title: string, message: string, options?: ToastOptions) => string;
    info: (title: string, message: string, options?: ToastOptions) => string;
    dismiss: (id: string) => void;
}

/**
 * Custom hook for easy notification usage throughout the app
 * 
 * @example
 * const { notify, success, error, warning, info } = useNotification();
 * 
 * success('Widget added successfully!');
 * error('Failed to save settings', { duration: 10000 });
 * warning('Connection lost, retrying...');
 * info('New feature available!', { 
 *   action: { label: 'Learn More', onClick: () => {} } 
 * });
 */
export const useNotification = (): UseNotificationReturn => {
    const {
        showToast,
        dismissToast,
        success,
        error,
        warning,
        info
    } = useNotifications();

    // Generic notify function
    const notify = (
        type: NotificationType,
        title: string,
        message: string,
        options?: ToastOptions
    ): string => {
        return showToast(type, title, message, options);
    };

    return {
        notify,
        success,
        error,
        warning,
        info,
        dismiss: dismissToast
    };
};

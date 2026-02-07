/**
 * ToastContext - Toast notification state management
 * 
 * Extracted from NotificationContext as part of P3 Phase 3 split.
 * Manages ephemeral toast notifications (success, error, warning, info).
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { setNotificationFunctions } from '../../utils/axiosSetup';
import logger from '../../utils/logger';
import type {
    Toast,
    NotificationType,
    ToastOptions
} from '../../../shared/types/notification';

// ============================================
// Types
// ============================================

export interface ToastContextValue {
    /** Active toast notifications */
    toasts: Toast[];

    /** Show a toast notification */
    showToast: (type: NotificationType, title: string, message: string, options?: ToastOptions) => string;

    /** Dismiss a toast by ID */
    dismissToast: (id: string) => void;

    /** Convenience: show success toast */
    success: (title: string, message: string, options?: ToastOptions) => string;

    /** Convenience: show error toast */
    error: (title: string, message: string, options?: ToastOptions) => string;

    /** Convenience: show warning toast */
    warning: (title: string, message: string, options?: ToastOptions) => string;

    /** Convenience: show info toast */
    info: (title: string, message: string, options?: ToastOptions) => string;
}

// ============================================
// Context
// ============================================

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps): React.JSX.Element => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Add toast notification
    const showToast = useCallback((type: NotificationType, title: string, message: string, options: ToastOptions = {}): string => {
        const id = options.id || `toast-${Date.now()}-${Math.random()}`;
        const toast: Toast = {
            id,
            type,
            title,
            message,
            iconId: options.iconId || null,
            iconIds: options.iconIds || undefined,
            metadata: options.metadata || null,
            duration: options.duration ?? 5000, // 0 = persistent, null/undefined = default
            action: options.action,
            actions: options.actions || undefined,
            onBodyClick: options.onBodyClick,
            notificationId: options.notificationId || null,
            createdAt: new Date()
        };

        setToasts(prev => {
            const updated = [toast, ...prev].slice(0, 5);
            return updated;
        });

        logger.debug('Toast notification shown', { type, title });

        return id;
    }, []);

    // Remove toast
    const dismissToast = useCallback((id: string): void => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // Convenience methods for toast types
    const success = useCallback((title: string, message: string, options?: ToastOptions): string => {
        return showToast('success', title, message, options);
    }, [showToast]);

    const error = useCallback((title: string, message: string, options?: ToastOptions): string => {
        return showToast('error', title, message, options);
    }, [showToast]);

    const warning = useCallback((title: string, message: string, options?: ToastOptions): string => {
        return showToast('warning', title, message, options);
    }, [showToast]);

    const info = useCallback((title: string, message: string, options?: ToastOptions): string => {
        return showToast('info', title, message, options);
    }, [showToast]);

    // Configure axios interceptor with notification functions
    useEffect(() => {
        setNotificationFunctions({ error });
    }, [error]);

    // Memoize context value
    const value: ToastContextValue = useMemo(() => ({
        toasts,
        showToast,
        dismissToast,
        success,
        error,
        warning,
        info
    }), [toasts, showToast, dismissToast, success, error, warning, info]);

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
};

// ============================================
// Hook
// ============================================

export const useToasts = (): ToastContextValue => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToasts must be used within a ToastProvider');
    }
    return context;
};

export { ToastContext };

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import ToastNotification from './ToastNotification';
import { useNotifications } from '../../context/NotificationContext';

/**
 * ToastContainer Component
 * 
 * Manages and renders all active toast notifications
 * - Renders via portal (outside DOM hierarchy)
 * - Stacks toasts vertically
 * - Limits to max 5 toasts
 * - Positioned in top-right corner
 */
const ToastContainer = (): React.ReactPortal => {
    const { toasts, dismissToast } = useNotifications();

    // Always render container so AnimatePresence can animate last toast exit

    const toastContent = (
        <div
            className="fixed right-4 z-[1070] flex flex-col gap-3 pointer-events-none"
            style={{
                top: 'calc(1rem + env(safe-area-inset-top, 0px))',
                right: 'calc(1rem + env(safe-area-inset-right, 0px))'
            }}
            aria-live="polite"
            aria-atomic="false"
        >
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastNotification
                            {...toast}
                            onDismiss={dismissToast}
                        />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );

    return createPortal(toastContent, document.body);
};

export default ToastContainer;

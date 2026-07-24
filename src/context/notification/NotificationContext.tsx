/**
 * NotificationContext - Unified notification system entry point
 */

import React, { ReactNode } from 'react';
import { ToastProvider } from './ToastContext';
import { NotificationCenterProvider } from './NotificationCenterContext';
import { PushProvider } from './PushContext';

interface NotificationProviderProps {
    children: ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps): React.JSX.Element => {
    return (
        <ToastProvider>
            <NotificationCenterProvider>
                <PushProvider>
                    {children}
                </PushProvider>
            </NotificationCenterProvider>
        </ToastProvider>
    );
};

export type { ToastContextValue } from './ToastContext';
export type { NotificationCenterContextValue } from './NotificationCenterContext';
export type { PushContextValue } from './PushContext';

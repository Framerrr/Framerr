import { useContext } from 'react';
import { NotificationCenterContext, type NotificationCenterContextValue } from './NotificationCenterContext';

export const useNotificationCenter = (): NotificationCenterContextValue => {
    const context = useContext(NotificationCenterContext);
    if (!context) {
        throw new Error('useNotificationCenter must be used within a NotificationCenterProvider');
    }
    return context;
};

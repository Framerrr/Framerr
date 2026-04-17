import { useEffect } from 'react';
import { configApi } from '../api/endpoints';

interface AppNameUpdateEvent extends CustomEvent {
    detail: {
        appName?: string;
    };
}

/**
 * AppTitle Component
 * Dynamically updates the browser tab title based on the customizable app name
 * Falls back to "Framerr" if no custom name is set
 */
const AppTitle = (): null => {
    useEffect(() => {
        const updateTitle = async (): Promise<void> => {
            try {
                const response = await configApi.getAppName();
                const appName = response?.name || 'Framerr';
                document.title = appName;
            } catch (error) {
                // Fallback to default if API fails
                document.title = 'Framerr';
            }
        };

        updateTitle();

        // Listen for custom events when app name is updated in settings
        const handleAppNameUpdate = (event: Event): void => {
            const customEvent = event as AppNameUpdateEvent;
            document.title = customEvent.detail.appName || 'Framerr';
        };

        window.addEventListener('appNameUpdated', handleAppNameUpdate);

        return () => {
            window.removeEventListener('appNameUpdated', handleAppNameUpdate);
        };
    }, []);

    return null; // This component doesn't render anything
};

export default AppTitle;

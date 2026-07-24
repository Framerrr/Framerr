import { useContext } from 'react';
import { AppBrandingContext, type AppBrandingContextValue } from './AppBrandingProvider';

export const useAppBranding = (): AppBrandingContextValue => {
    const context = useContext(AppBrandingContext);
    if (!context) {
        throw new Error('useAppBranding must be used within an AppBrandingProvider');
    }
    return context;
};

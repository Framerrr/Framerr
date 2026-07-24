import { useContext } from 'react';
import { SidebarNavigationContext } from './SidebarNavigationContext';

export function useSidebarNavigation() {
    const context = useContext(SidebarNavigationContext);
    if (!context) {
        throw new Error('useSidebarNavigation must be used within SidebarNavigationProvider');
    }
    return context;
}

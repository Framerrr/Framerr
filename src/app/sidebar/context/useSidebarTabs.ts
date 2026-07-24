import { useContext } from 'react';
import { SidebarTabsContext } from './SidebarTabsContext';

export function useSidebarTabs() {
    const context = useContext(SidebarTabsContext);
    if (!context) {
        throw new Error('useSidebarTabs must be used within SidebarTabsProvider');
    }
    return context;
}

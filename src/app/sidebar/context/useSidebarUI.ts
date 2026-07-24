import { useContext } from 'react';
import { SidebarUIContext } from './SidebarUIContext';

export function useSidebarUI() {
    const context = useContext(SidebarUIContext);
    if (!context) {
        throw new Error('useSidebarUI must be used within SidebarUIProvider');
    }
    return context;
}

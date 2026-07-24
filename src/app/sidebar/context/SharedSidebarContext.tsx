import React, { ReactNode, useCallback, createContext } from 'react';
import { SidebarUIProvider } from './SidebarUIContext';
import { useSidebarUI } from './useSidebarUI';
import { SidebarTabsProvider } from './SidebarTabsContext';
import { useSidebarTabs } from './useSidebarTabs';
import { SidebarNavigationProvider, SidebarMode } from './SidebarNavigationContext';

export type { SidebarMode };

interface SharedSidebarProviderProps {
    children: ReactNode;
}

export function SharedSidebarProvider({ children }: SharedSidebarProviderProps) {
    return (
        <SidebarTabsProvider>
            <SidebarUIProvider>
                <SidebarNavigationBridge>
                    {children}
                </SidebarNavigationBridge>
            </SidebarUIProvider>
        </SidebarTabsProvider>
    );
}

function SidebarNavigationBridge({ children }: { children: ReactNode }) {
    const { tabs } = useSidebarTabs();
    const { isExpanded, setIsExpanded } = useSidebarUI();

    const handleExpandSidebar = useCallback(() => {
        if (!isExpanded) {
            setIsExpanded(true);
        }
    }, [isExpanded, setIsExpanded]);

    return (
        <SidebarNavigationProvider tabs={tabs} onExpandSidebar={handleExpandSidebar}>
            {children}
        </SidebarNavigationProvider>
    );
}

import type { useSharedSidebar } from './useSharedSidebar';
const SharedSidebarContext = createContext<ReturnType<typeof useSharedSidebar> | null>(null);
export { SharedSidebarContext };

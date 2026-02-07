// Sidebar Context - Split for optimized re-renders
// Primary export: useSharedSidebar (BWC hook)
// Sub-context exports for focused access

export { SharedSidebarProvider, useSharedSidebar, SharedSidebarContext, type SidebarMode } from './SharedSidebarContext';
export { SidebarUIProvider, useSidebarUI } from './SidebarUIContext';
export { SidebarTabsProvider, useSidebarTabs } from './SidebarTabsContext';
export { SidebarNavigationProvider, useSidebarNavigation } from './SidebarNavigationContext';

// Sidebar components barrel exports
export { SharedSidebarProvider, useSharedSidebar, SharedSidebarContext, type SidebarMode } from './SharedSidebarContext';
// Sub-context exports for focused access
export { useSidebarUI, useSidebarTabs, useSidebarNavigation } from './context';
export { NavItem } from './NavItem';
export { DesktopSidebar } from './DesktopSidebar';
export { MobileTabBar } from './MobileTabBar';
export * from './types';

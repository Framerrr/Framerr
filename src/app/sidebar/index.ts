// Sidebar components barrel exports
export { SharedSidebarProvider, SharedSidebarContext, type SidebarMode } from './context/SharedSidebarContext';
export { useSharedSidebar } from './context/useSharedSidebar';
// Sub-context exports for focused access
export { useSidebarUI, useSidebarTabs, useSidebarNavigation } from './context';
export { NavItem } from './NavItem';
export { DesktopSidebar } from '@/components/sidebar/DesktopSidebar';
export { MobileTabBar } from '@/components/sidebar/MobileTabBar';
export * from './types';

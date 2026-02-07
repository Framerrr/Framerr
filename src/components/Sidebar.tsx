import React from 'react';
import { useLayout } from '../context/LayoutContext';
import { DesktopSidebar } from './sidebar/DesktopSidebar';
import { MobileTabBar } from './sidebar/MobileTabBar';

/**
 * Sidebar Router Component
 * Renders appropriate sidebar for viewport (provider is in App.tsx)
 */
const Sidebar: React.FC = () => {
    const { isMobile } = useLayout();

    return isMobile ? <MobileTabBar /> : <DesktopSidebar />;
};

export default Sidebar;

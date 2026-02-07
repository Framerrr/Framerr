/**
 * CustomizationSettings - Router
 * 
 * Routes to the appropriate page based on activeSubTab.
 * Sub-tabs: general, colors, favicon
 * 
 * Note: Removed crossfade animation in favor of simple conditional routing.
 * Each page now manages its own state via useCustomizationState hook.
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { GeneralPage } from './pages/GeneralPage';
import { ColorsPage } from './pages/ColorsPage';
import { FaviconPage } from './pages/FaviconPage';
import type { CustomizationSettingsProps, SubTabId } from './types';

const CustomizationSettings: React.FC<CustomizationSettingsProps> = ({ activeSubTab: propSubTab }) => {
    const { user } = useAuth();
    const hasAdminAccess = isAdmin(user);

    // Default to 'general' if no sub-tab provided
    const activeSubTab: SubTabId = (propSubTab as SubTabId) || 'general';

    // Simple conditional routing - each page handles its own state
    if (activeSubTab === 'general') return <GeneralPage />;
    if (activeSubTab === 'colors') return <ColorsPage />;
    if (activeSubTab === 'favicon' && hasAdminAccess) return <FaviconPage />;

    // Default fallback
    return <GeneralPage />;
};

export default CustomizationSettings;

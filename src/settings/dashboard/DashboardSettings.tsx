/**
 * DashboardSettings - Router
 * 
 * Routes to the appropriate page based on activeSubTab.
 * Sub-tabs: general, templates
 */

import React from 'react';
import { GeneralPage } from './pages/GeneralPage';
import { TemplatesPage } from './pages/TemplatesPage';

type SubTabId = 'general' | 'templates';

interface DashboardSettingsProps {
    activeSubTab?: string | null;
}

export const DashboardSettings: React.FC<DashboardSettingsProps> = ({ activeSubTab: propSubTab }) => {
    // Default to 'general' if no sub-tab provided
    const activeSubTab: SubTabId = (propSubTab as SubTabId) || 'general';

    // Simple conditional routing
    if (activeSubTab === 'general') return <GeneralPage />;
    if (activeSubTab === 'templates') return <TemplatesPage />;

    // Default fallback
    return <GeneralPage />;
};

export default DashboardSettings;

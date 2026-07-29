/**
 * DashboardSettings - Router
 * 
 * Routes to the appropriate page based on activeSubTab.
 * Sub-tabs: general, templates
 */

import React from 'react';
import { LayoutSection } from './sections/LayoutSection';
import { DashboardsSection } from './sections/DashboardsSection';
import { TemplateSettings } from '../templates';
import { SettingsPage } from '../../shared/ui/settings';

type SubTabId = 'general' | 'templates';

interface DashboardSettingsProps {
    activeSubTab?: string | null;
}

export const DashboardSettings: React.FC<DashboardSettingsProps> = ({ activeSubTab: propSubTab }) => {
    // Default to 'general' if no sub-tab provided
    const activeSubTab: SubTabId = (propSubTab as SubTabId) || 'general';

    // Simple conditional routing
    if (activeSubTab === 'general') {
        return (
            <SettingsPage
                title="General"
                description="Manage your dashboards, layout, and preferences"
            >
                <DashboardsSection />
                <LayoutSection embedded />
            </SettingsPage>
        );
    }
    if (activeSubTab === 'templates') return <TemplateSettings />;

    // Default fallback
    return <LayoutSection />;
};

export default DashboardSettings;

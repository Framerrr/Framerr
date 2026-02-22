/**
 * IntegrationsSettings - Router
 * 
 * Routes to the appropriate page based on activeSubTab.
 * Sub-tabs: gallery, active, services, shared, linked
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { WidgetGalleryPage } from './pages/WidgetGalleryPage';
import { ActiveWidgetsPage } from './pages/ActiveWidgetsPage';
import { ServiceSettingsPage } from './pages/ServiceSettingsPage';
import { SharedWidgetsPage } from './pages/SharedWidgetsPage';
import { LinkedAccountsPage } from './pages/LinkedAccountsPage';

type SubTabId = 'gallery' | 'active' | 'services' | 'shared' | 'linked';

interface IntegrationsSettingsProps {
    activeSubTab?: string | null;
}

export const IntegrationsSettings: React.FC<IntegrationsSettingsProps> = ({ activeSubTab: propSubTab }) => {
    const { user } = useAuth();
    const hasAdminAccess = isAdmin(user);

    // Default to 'services' for admins (primary tab), 'gallery' for non-admins
    const activeSubTab: SubTabId = (propSubTab as SubTabId) || (hasAdminAccess ? 'services' : 'gallery');

    // Simple conditional routing - each page handles its own content
    if (activeSubTab === 'gallery') return <WidgetGalleryPage />;
    if (activeSubTab === 'active') return <ActiveWidgetsPage />;
    if (activeSubTab === 'services' && hasAdminAccess) return <ServiceSettingsPage />;
    if (activeSubTab === 'shared' && hasAdminAccess) return <SharedWidgetsPage />;
    if (activeSubTab === 'linked') return <LinkedAccountsPage />;

    // Default fallback
    return <WidgetGalleryPage />;
};

export default IntegrationsSettings;

/**
 * Settings Component Registry
 * 
 * Maps category IDs to React component render functions.
 * Imported only by SettingsPage.tsx — this is internal to the settings page.
 * All component imports are centralized here.
 */

import React from 'react';

// User Settings Components
import { TabSettings } from '../tabs';
import { TabGroupsSettings } from '../tabgroups';
import { CustomizationSettings } from '../customization';
import { ProfileSettings } from '../profile';
import { NotificationSettings } from '../notifications';
import { LinkedAccountsPage } from '../integrations/pages/LinkedAccountsPage';

// Admin Settings Components
import { UserManagementSettings } from '../users';
import { IntegrationsSettings } from '../integrations';
import { AuthSettings } from '../auth';
import { AdvancedSettings } from '../advanced';
import { DashboardSettings } from '../dashboard';

/**
 * Map category ID to the component that renders it.
 * 
 * @param categoryId - Top-level settings category (e.g. 'tabs', 'customization')
 * @param hasAdminAccess - Whether the current user has admin privileges
 * @param activeSubTab - Currently active sub-tab within the category, if any
 */
export function getCategoryComponent(
    categoryId: string,
    hasAdminAccess: boolean,
    activeSubTab: string | null
): React.ReactNode {
    switch (categoryId) {
        case 'tabs':
            return React.createElement(TabSettings);
        case 'tabgroups':
            return React.createElement(TabGroupsSettings);
        case 'integrations':
            return React.createElement(IntegrationsSettings, { activeSubTab });
        case 'dashboard':
            return React.createElement(DashboardSettings, { activeSubTab });
        case 'customization':
            return React.createElement(CustomizationSettings, { activeSubTab });
        case 'account':
            if (activeSubTab === 'connected') return React.createElement(LinkedAccountsPage);
            return React.createElement(ProfileSettings);
        case 'notifications':
            return React.createElement(NotificationSettings);
        case 'users':
            return hasAdminAccess ? React.createElement(UserManagementSettings, { activeSubTab }) : null;
        case 'auth':
            return hasAdminAccess ? React.createElement(AuthSettings, { activeSubTab }) : null;
        case 'advanced':
            return hasAdminAccess ? React.createElement(AdvancedSettings, { activeSubTab }) : null;
        default:
            return null;
    }
}

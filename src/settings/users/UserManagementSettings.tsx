/**
 * UserManagementSettings - Router
 * 
 * Routes to the appropriate page based on activeSubTab.
 * Sub-tabs: list (Users), groups (Groups)
 */

import React from 'react';
import { UsersPage } from './pages/UsersPage';
import { GroupsPage } from './pages/GroupsPage';

type SubTabId = 'list' | 'groups';

interface UserManagementSettingsProps {
    activeSubTab?: string | null;
}

export const UserManagementSettings: React.FC<UserManagementSettingsProps> = ({ activeSubTab: propSubTab }) => {
    // Default to 'list' if no sub-tab provided
    const activeSubTab: SubTabId = (propSubTab as SubTabId) || 'list';

    // Simple conditional routing
    if (activeSubTab === 'list') return <UsersPage />;
    if (activeSubTab === 'groups') return <GroupsPage />;

    // Default fallback
    return <UsersPage />;
};

export default UserManagementSettings;

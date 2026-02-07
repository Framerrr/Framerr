/**
 * TabGroupsSettings - Router
 * 
 * Router for the "Tab Groups" category.
 * Currently a single-page category (no sub-tabs).
 */

import React from 'react';
import { GroupsPage } from './pages/GroupsPage';

export const TabGroupsSettings: React.FC = () => {
    // Single page - no sub-tabs needed
    return <GroupsPage />;
};

export default TabGroupsSettings;

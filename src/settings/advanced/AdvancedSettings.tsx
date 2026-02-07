/**
 * AdvancedSettings - Router
 * 
 * Routes to the appropriate page based on activeSubTab.
 * Sub-tabs: debug, system, backup, jobs, experimental, developer
 */

import React from 'react';
import { DebugPage } from './pages/DebugPage';
import { SystemPage } from './pages/SystemPage';
import { BackupPage } from './pages/BackupPage';
import { ExperimentalPage } from './pages/ExperimentalPage';
import { DeveloperPage } from './pages/DeveloperPage';
import { JobsPage } from './pages/JobsPage';

type SubTabId = 'debug' | 'system' | 'backup' | 'jobs' | 'experimental' | 'developer';

interface AdvancedSettingsProps {
    activeSubTab?: string | null;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({ activeSubTab: propSubTab }) => {
    // Default to 'debug' if no sub-tab provided
    const activeSubTab: SubTabId = (propSubTab as SubTabId) || 'debug';

    // Simple conditional routing - each page handles its own content
    if (activeSubTab === 'debug') return <DebugPage />;
    if (activeSubTab === 'system') return <SystemPage />;
    if (activeSubTab === 'backup') return <BackupPage />;
    if (activeSubTab === 'jobs') return <JobsPage />;
    if (activeSubTab === 'experimental') return <ExperimentalPage />;
    if (activeSubTab === 'developer') return <DeveloperPage />;

    // Default fallback
    return <DebugPage />;
};

export default AdvancedSettings;

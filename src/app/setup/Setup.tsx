import React from 'react';
import SetupWizard from './SetupWizard';

/**
 * Setup Page
 * Multi-step wizard for initial Framerr configuration
 * 
 * Steps:
 * 1. Welcome - Logo and intro
 * 2. Theme - Select visual theme
 * 3. Account - Create admin account (auto-logs in)
 * 4. Customize - App name, flatten UI
 * 5. Auth - Plex SSO setup (optional)
 * 6. Complete - Summary and go to dashboard
 */
const Setup: React.FC = () => {
    return <SetupWizard />;
};

export default Setup;

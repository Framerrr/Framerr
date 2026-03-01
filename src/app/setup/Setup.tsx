import React from 'react';
import { Navigate } from 'react-router-dom';
import SetupWizard from './SetupWizard';
import { useAuth } from '../../context/AuthContext';

/**
 * Setup Page
 * Multi-step wizard for initial Framerr configuration
 * 
 * Steps:
 * 1. Welcome - Logo and intro
 * 2. Choice - Fresh setup or restore
 * 3. Account - Create admin account (auto-logs in, point of no return)
 * 4. Theme - Select visual theme
 * 5. Customize - App name, flatten UI
 * 6. Auth - Plex SSO setup (optional)
 * 7. Complete - Summary and go to dashboard
 * 
 * This component gates the wizard behind two checks:
 * 1. Don't render until AuthContext finishes loading (splash covers the page)
 * 2. If setup is already complete, redirect to /login
 * 
 * The redirect-away logic lives HERE, not in AuthContext's redirect effect.
 * Having it in AuthContext caused a race condition: needsSetup defaults to
 * false, so the effect would briefly redirect /setup → /login before the
 * async check confirmed needsSetup=true, causing a redirect cycle.
 */
const Setup: React.FC = () => {
    const { loading, needsSetup } = useAuth();

    // Wait for auth check to complete (splash screen covers the page)
    if (loading) return null;

    // Setup already complete — redirect to login
    if (!needsSetup) return <Navigate to="/login" replace />;

    return <SetupWizard />;
};

export default Setup;


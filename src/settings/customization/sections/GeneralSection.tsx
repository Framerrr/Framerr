/**
 * General Section Component
 * 
 * Container for the General tab content (Branding, Greeting, Flatten UI).
 */

import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { isAdmin } from '../../../utils/permissions';
import { SettingsPage } from '../../../shared/ui/settings';
import { BrandingSection } from './BrandingSection';
import { GreetingSection } from './GreetingSection';
import { FlattenUISection } from './FlattenUISection';
import type { CustomizationState } from '../types';

interface GeneralSectionProps {
    state: CustomizationState;
}

export function GeneralSection({ state }: GeneralSectionProps) {
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    return (
        <SettingsPage
            title="General"
            description="Customize your dashboard appearance and branding"
        >
            {/* Application Branding Section - Admin Only */}
            {userIsAdmin && (
                <BrandingSection
                    applicationName={state.applicationName}
                    setApplicationName={state.setApplicationName}
                    applicationIcon={state.applicationIcon}
                    setApplicationIcon={state.setApplicationIcon}
                    savingAppName={state.savingAppName}
                    hasAppNameChanges={state.hasAppNameChanges}
                    handleSaveApplicationName={state.handleSaveApplicationName}
                />
            )}

            {/* Dashboard Greeting Section */}
            <GreetingSection
                greetingEnabled={state.greetingEnabled}
                setGreetingEnabled={state.setGreetingEnabled}
                greetingText={state.greetingText}
                setGreetingText={state.setGreetingText}
                savingGreeting={state.savingGreeting}
                hasGreetingChanges={state.hasGreetingChanges}
                handleSaveGreeting={state.handleSaveGreeting}
                handleResetGreeting={state.handleResetGreeting}
            />

            {/* Flatten UI Section */}
            <FlattenUISection
                flattenUI={state.flattenUI}
                savingFlattenUI={state.savingFlattenUI}
                handleToggleFlattenUI={state.handleToggleFlattenUI}
            />
        </SettingsPage>
    );
}


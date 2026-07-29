/**
 * General Section Component
 * 
 * Container for the General tab content (Branding, Greeting, Flatten UI).
 */

import React from 'react';
import { useAuth } from '../../../context/useAuth';
import { useAppBranding } from '../../../app/providers/useAppBranding';
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
    const { brandingLoaded } = useAppBranding();

    return (
        <SettingsPage
            title="General"
            description="Customize your dashboard appearance and branding"
        >
            {/* Application Branding Section - Admin Only (wait for app branding to avoid default flash) */}
            {userIsAdmin && brandingLoaded && (
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
                headerVisible={state.headerVisible}
                setHeaderVisible={state.setHeaderVisible}
                greetingMode={state.greetingMode}
                setGreetingMode={state.setGreetingMode}
                greetingText={state.greetingText}
                setGreetingText={state.setGreetingText}
                tones={state.tones}
                setTones={state.setTones}
                loadingMessagesEnabled={state.loadingMessagesEnabled}
                setLoadingMessagesEnabled={state.setLoadingMessagesEnabled}
                taglineEnabled={state.taglineEnabled}
                setTaglineEnabled={state.setTaglineEnabled}
                taglineText={state.taglineText}
                setTaglineText={state.setTaglineText}
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


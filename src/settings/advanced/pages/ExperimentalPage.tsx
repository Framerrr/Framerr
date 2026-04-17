import React from 'react';
import { Beaker } from 'lucide-react';
import { SettingsPage, SettingsSection, EmptyState } from '../../../shared/ui/settings';

/**
 * ExperimentalPage - Feature flags and beta functionality
 *
 * Holding area for upcoming experimental features.
 * Metric History Recording has graduated to Advanced → System.
 */
export const ExperimentalPage = (): React.JSX.Element => {
    return (
        <SettingsPage
            title="Experimental"
            description="Control experimental features and beta functionality"
        >
            <SettingsSection title="More Features" icon={Beaker}>
                <EmptyState
                    icon={Beaker}
                    message="More experimental features coming soon"
                />
            </SettingsSection>
        </SettingsPage>
    );
};

export default ExperimentalPage;

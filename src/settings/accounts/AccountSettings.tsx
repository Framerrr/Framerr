import React from 'react';
import { Link2 } from 'lucide-react';
import { SettingsPage, SettingsSection, SettingsAlert } from '../../shared/ui/settings';
import { useAccountSettings } from './hooks/useAccountSettings';
import { PlexSection } from './sections/PlexSection';
import { OverseerrSection } from './sections/OverseerrSection';
import { OverseerrLinkModal } from './components/OverseerrLinkModal';

/**
 * AccountSettings - User's linked external service accounts
 * Thin orchestrator that composes sections and modals
 */
const AccountSettings: React.FC = () => {
    const {
        loading,
        dbLinkedAccounts,
        plexSSOEnabled,
        hasOverseerrAccess,
        plexLinking,
        plexUnlinking,
        overseerrModalOpen,
        overseerrUsername,
        overseerrPassword,
        overseerrLinking,
        overseerrUnlinking,
        overseerrError,
        handleConnectPlex,
        handleDisconnectPlex,
        handleOpenOverseerrModal,
        handleCloseOverseerrModal,
        handleLinkOverseerr,
        handleDisconnectOverseerr,
        setOverseerrUsername,
        setOverseerrPassword
    } = useAccountSettings();

    if (loading) {
        return <div className="text-center py-16 text-theme-secondary">Loading linked accounts...</div>;
    }

    const plexAccount = dbLinkedAccounts.plex;
    const isPlexLinked = !!plexAccount?.linked;

    const overseerrAccount = dbLinkedAccounts.overseerr;
    const isOverseerrLinked = !!overseerrAccount?.linked;

    return (
        <SettingsPage
            title="Linked Accounts"
            description="Connect external services to personalize your Framerr experience"
        >
            <SettingsSection title="External Services" icon={Link2}>
                {/* Info Banner */}
                <SettingsAlert type="info" className="mb-4">
                    <strong>About Linked Accounts:</strong> Connect your external accounts to Framerr for personalized content, notifications, and streamlined sign-in.
                    Credentials are only used for verification and never stored.
                </SettingsAlert>

                {/* Linked Accounts List */}
                <div className="space-y-4">
                    {/* Plex Account */}
                    <PlexSection
                        plexAccount={plexAccount}
                        isPlexLinked={isPlexLinked}
                        plexSSOEnabled={plexSSOEnabled}
                        plexLinking={plexLinking}
                        plexUnlinking={plexUnlinking}
                        onConnect={handleConnectPlex}
                        onDisconnect={handleDisconnectPlex}
                    />

                    {/* Overseerr Account */}
                    {hasOverseerrAccess && (
                        <OverseerrSection
                            overseerrAccount={overseerrAccount}
                            isOverseerrLinked={isOverseerrLinked}
                            plexUsername={plexAccount?.externalUsername}
                            isPlexLinked={isPlexLinked}
                            overseerrUnlinking={overseerrUnlinking}
                            onOpenModal={handleOpenOverseerrModal}
                            onDisconnect={handleDisconnectOverseerr}
                        />
                    )}

                    {/* Placeholder for future integrations */}
                    <div className="bg-theme-tertiary rounded-lg p-6 border border-theme opacity-50">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-theme-secondary/10 rounded-lg">
                                <Link2 className="text-theme-secondary" size={24} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-theme-secondary">More Coming Soon</h3>
                                <p className="text-sm text-theme-tertiary">
                                    Additional service linking options will be added in future updates
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </SettingsSection>

            {/* Overseerr Link Modal */}
            <OverseerrLinkModal
                isOpen={overseerrModalOpen}
                username={overseerrUsername}
                password={overseerrPassword}
                error={overseerrError}
                linking={overseerrLinking}
                onClose={handleCloseOverseerrModal}
                onSubmit={handleLinkOverseerr}
                onUsernameChange={setOverseerrUsername}
                onPasswordChange={setOverseerrPassword}
            />
        </SettingsPage>
    );
};

export default AccountSettings;

import React from 'react';
import { Link2 } from 'lucide-react';
import { SettingsPage, SettingsSection, SettingsAlert } from '../../shared/ui/settings';
import { useAccountSettings } from './hooks/useAccountSettings';
import { PlexSection } from './sections/PlexSection';
import { OidcSection } from './sections/OidcSection';
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
        // OIDC state
        oidcSSOEnabled,
        oidcDisplayName,
        oidcButtonIcon,
        oidcConnecting,
        oidcDisconnecting,
        handleConnectOidc,
        handleDisconnectOidc,
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
            title="Connected Accounts"
            description="Connect external services to personalize your Framerr experience"
        >
            <SettingsSection title="External Services" icon={Link2}>
                {/* Info Banner */}
                <SettingsAlert type="info" className="mb-4">
                    <strong>About Linked Accounts:</strong> Connect your external accounts to Framerr for single sign-on, personalized content, and streamlined access.
                    Your passwords are never stored by Framerr.
                </SettingsAlert>

                {/* Linked Accounts List */}
                <div className="space-y-4">
                    {/* Plex Account */}
                    {plexSSOEnabled && (
                        <PlexSection
                            plexAccount={plexAccount}
                            isPlexLinked={isPlexLinked}
                            plexLinking={plexLinking}
                            plexUnlinking={plexUnlinking}
                            onConnect={handleConnectPlex}
                            onDisconnect={handleDisconnectPlex}
                        />
                    )}

                    {/* OIDC Account */}
                    {oidcSSOEnabled && (
                        <OidcSection
                            oidcAccount={dbLinkedAccounts.oidc}
                            isOidcLinked={!!dbLinkedAccounts.oidc?.linked}
                            oidcDisplayName={oidcDisplayName}
                            oidcButtonIcon={oidcButtonIcon}
                            oidcConnecting={oidcConnecting}
                            oidcDisconnecting={oidcDisconnecting}
                            onConnect={handleConnectOidc}
                            onDisconnect={handleDisconnectOidc}
                        />
                    )
                    }

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

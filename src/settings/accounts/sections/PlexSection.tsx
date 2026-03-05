import React from 'react';
import { Loader, CheckCircle2, Unlink, ExternalLink } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { getIconComponent } from '../../../utils/iconUtils';
import type { LinkedAccountData } from '../types';

interface PlexSectionProps {
    plexAccount: LinkedAccountData | undefined;
    isPlexLinked: boolean;
    plexLinking: boolean;
    plexUnlinking: boolean;
    onConnect: () => Promise<void>;
    onDisconnect: () => Promise<void>;
}

/**
 * Plex account linking section
 * Only rendered when Plex SSO is enabled (parent gates visibility)
 */
export const PlexSection: React.FC<PlexSectionProps> = ({
    plexAccount,
    isPlexLinked,
    plexLinking,
    plexUnlinking,
    onConnect,
    onDisconnect
}) => {
    const linkedVia = plexAccount?.metadata?.linkedVia;
    const PlexIcon = getIconComponent('system:plex');

    return (
        <div className="bg-theme-tertiary rounded-lg p-4 sm:p-6 border border-theme">
            <div className="flex items-start gap-3 sm:gap-4">
                <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${isPlexLinked ? 'bg-success/20' : 'bg-theme-tertiary'}`}>
                    <PlexIcon className={isPlexLinked ? 'text-success' : 'text-theme-secondary'} size={20} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-theme-primary">Plex</h3>
                        {isPlexLinked && (
                            <span className="flex items-center gap-1 text-[10px] sm:text-xs bg-success/20 text-success px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                                <CheckCircle2 size={10} className="sm:hidden" />
                                <CheckCircle2 size={12} className="hidden sm:block" />
                                Connected
                            </span>
                        )}
                    </div>

                    {isPlexLinked ? (
                        <div className="text-sm text-theme-secondary">
                            <p className="mb-3 hidden sm:block">
                                {linkedVia === 'sso-link-existing' || linkedVia === 'sso-create-account'
                                    ? 'Connected during Plex sign-in.'
                                    : linkedVia === 'sso-admin'
                                        ? 'Connected as Plex server admin.'
                                        : linkedVia === 'manual'
                                            ? 'Manually connected from settings.'
                                            : 'Your Plex account is connected.'}
                                {' '}You can use &quot;Continue with Plex&quot; to sign in.
                            </p>
                            <div className="bg-theme-tertiary/50 rounded-lg p-2 sm:p-3 text-xs sm:text-sm mb-3">
                                <p className="truncate">
                                    <span className="text-theme-tertiary">User:</span>{' '}
                                    <span className="text-theme-primary font-medium">
                                        {plexAccount?.externalUsername || 'Unknown'}
                                    </span>
                                </p>
                                {plexAccount?.externalEmail && (
                                    <p className="truncate mt-1">
                                        <span className="text-theme-tertiary">Email:</span>{' '}
                                        <span className="text-theme-primary">{plexAccount.externalEmail}</span>
                                    </p>
                                )}
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onDisconnect}
                                disabled={plexUnlinking}
                                icon={plexUnlinking ? Loader : Unlink}
                                style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: 'var(--warning)', borderColor: 'rgba(234, 179, 8, 0.3)' }}
                            >
                                {plexUnlinking ? 'Disconnecting...' : 'Disconnect Plex'}
                            </Button>
                        </div>
                    ) : (
                        <div className="text-sm text-theme-secondary">
                            <p className="mb-3">
                                Connect your Plex account to use &quot;Continue with Plex&quot; sign-in.
                            </p>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onConnect}
                                disabled={plexLinking}
                                icon={plexLinking ? Loader : ExternalLink}
                            >
                                {plexLinking ? 'Connecting...' : 'Connect Plex Account'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

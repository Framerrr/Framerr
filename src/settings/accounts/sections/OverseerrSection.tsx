import React from 'react';
import { Star, Loader, CheckCircle2, Unlink, Link2 } from 'lucide-react';
import { Button } from '../../../shared/ui';
import type { LinkedAccountData } from '../types';

interface OverseerrSectionProps {
    overseerrAccount: LinkedAccountData | undefined;
    isOverseerrLinked: boolean;
    plexUsername: string | null | undefined;
    isPlexLinked: boolean;
    overseerrUnlinking: boolean;
    onOpenModal: () => void;
    onDisconnect: () => Promise<void>;
}

/**
 * Overseerr account linking section
 * Allows users to connect/disconnect their Overseerr account for personalized notifications
 */
export const OverseerrSection: React.FC<OverseerrSectionProps> = ({
    overseerrAccount,
    isOverseerrLinked,
    plexUsername,
    isPlexLinked,
    overseerrUnlinking,
    onOpenModal,
    onDisconnect
}) => {
    return (
        <div className="bg-theme-tertiary rounded-lg p-4 sm:p-6 border border-theme">
            <div className="flex items-start gap-3 sm:gap-4">
                <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${isOverseerrLinked ? 'bg-success/20' : 'bg-theme-tertiary'}`}>
                    <Star className={isOverseerrLinked ? 'text-success' : 'text-theme-secondary'} size={20} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-theme-primary">Overseerr</h3>
                        {isOverseerrLinked && (
                            <span className="flex items-center gap-1 text-[10px] sm:text-xs bg-success/20 text-success px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                                <CheckCircle2 size={10} className="sm:hidden" />
                                <CheckCircle2 size={12} className="hidden sm:block" />
                                Connected
                            </span>
                        )}
                    </div>

                    {isOverseerrLinked ? (
                        <div className="text-sm text-theme-secondary">
                            <p className="mb-3 hidden sm:block">
                                Linked for personalized notifications and widget filtering.
                            </p>
                            <div className="bg-theme-tertiary/50 rounded-lg p-2 sm:p-3 text-xs sm:text-sm mb-3">
                                <p className="truncate">
                                    <span className="text-theme-tertiary">User:</span>{' '}
                                    <span className="text-theme-primary font-medium">
                                        {overseerrAccount?.externalUsername || 'Unknown'}
                                    </span>
                                </p>
                                {overseerrAccount?.externalEmail && (
                                    <p className="truncate mt-1">
                                        <span className="text-theme-tertiary">Email:</span>{' '}
                                        <span className="text-theme-primary">{overseerrAccount.externalEmail}</span>
                                    </p>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDisconnect}
                                disabled={overseerrUnlinking}
                                icon={overseerrUnlinking ? Loader : Unlink}
                                className="text-warning hover:text-warning hover:bg-warning/10"
                            >
                                {overseerrUnlinking ? 'Disconnecting...' : 'Disconnect Overseerr'}
                            </Button>
                        </div>
                    ) : (
                        <div className="text-sm text-theme-secondary">
                            {isPlexLinked ? (
                                <>
                                    <p className="mb-2">
                                        Notifications will auto-match if your Overseerr username matches your Plex username
                                        (<strong className="text-theme-primary">{plexUsername}</strong>).
                                    </p>
                                    <p className="mb-3 text-theme-tertiary text-xs">
                                        If your Overseerr username differs, link manually below.
                                    </p>
                                </>
                            ) : (
                                <p className="mb-3">
                                    Link your Overseerr account to receive personalized notifications for your requests.
                                </p>
                            )}
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onOpenModal}
                                icon={Link2}
                            >
                                {isPlexLinked ? 'Link Overseerr Manually' : 'Sign in with Overseerr'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

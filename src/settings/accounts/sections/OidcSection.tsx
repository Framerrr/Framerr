import React from 'react';
import { Loader, CheckCircle2, Unlink, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { getIconComponent } from '../../../utils/iconUtils';
import type { LinkedAccountData } from '../types';

interface OidcSectionProps {
    oidcAccount: LinkedAccountData | undefined;
    isOidcLinked: boolean;
    oidcDisplayName: string;
    oidcButtonIcon: string;
    oidcConnecting: boolean;
    oidcDisconnecting: boolean;
    onConnect: () => Promise<void>;
    onDisconnect: () => Promise<void>;
}

/**
 * OIDC account linking section
 * Allows users to connect/disconnect their OIDC account for SSO
 */
export const OidcSection: React.FC<OidcSectionProps> = ({
    oidcAccount,
    isOidcLinked,
    oidcDisplayName,
    oidcButtonIcon,
    oidcConnecting,
    oidcDisconnecting,
    onConnect,
    onDisconnect
}) => {
    const IconComponent = getIconComponent(oidcButtonIcon);
    return (
        <div className="bg-theme-tertiary rounded-lg p-4 sm:p-6 border border-theme">
            <div className="flex items-start gap-3 sm:gap-4">
                <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${isOidcLinked ? 'bg-success/20' : 'bg-theme-tertiary'}`}>
                    <IconComponent className={isOidcLinked ? 'text-success' : 'text-theme-secondary'} size={20} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-theme-primary">{oidcDisplayName}</h3>
                        {isOidcLinked && (
                            <span className="flex items-center gap-1 text-[10px] sm:text-xs bg-success/20 text-success px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                                <CheckCircle2 size={10} className="sm:hidden" />
                                <CheckCircle2 size={12} className="hidden sm:block" />
                                Connected
                            </span>
                        )}
                    </div>

                    {isOidcLinked ? (
                        <div className="text-sm text-theme-secondary">
                            <p className="mb-3 hidden sm:block">
                                Your {oidcDisplayName} account is connected. You can use it to sign in.
                            </p>
                            <div className="bg-theme-tertiary/50 rounded-lg p-2 sm:p-3 text-xs sm:text-sm mb-3">
                                {oidcAccount?.externalUsername && (
                                    <p className="truncate">
                                        <span className="text-theme-tertiary">User:</span>{' '}
                                        <span className="text-theme-primary font-medium">
                                            {oidcAccount.externalUsername}
                                        </span>
                                    </p>
                                )}
                                {oidcAccount?.externalEmail && (
                                    <p className="truncate mt-1">
                                        <span className="text-theme-tertiary">Email:</span>{' '}
                                        <span className="text-theme-primary">{oidcAccount.externalEmail}</span>
                                    </p>
                                )}
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onDisconnect}
                                disabled={oidcDisconnecting}
                                icon={oidcDisconnecting ? Loader : Unlink}
                                style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: 'var(--warning)', borderColor: 'rgba(234, 179, 8, 0.3)' }}
                            >
                                {oidcDisconnecting ? 'Disconnecting...' : `Disconnect ${oidcDisplayName}`}
                            </Button>
                        </div>
                    ) : (
                        <div className="text-sm text-theme-secondary">
                            <p className="mb-3">
                                Connect your {oidcDisplayName} account to sign in with single sign-on.
                            </p>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onConnect}
                                disabled={oidcConnecting}
                                icon={oidcConnecting ? Loader : ExternalLink}
                            >
                                {oidcConnecting ? 'Connecting...' : `Connect ${oidcDisplayName}`}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

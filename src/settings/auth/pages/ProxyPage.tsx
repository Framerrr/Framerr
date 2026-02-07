/**
 * ProxyPage
 * Auth proxy configuration UI
 */

import React, { ChangeEvent } from 'react';
import { Shield } from 'lucide-react';
import { Input } from '../../../components/common/Input';
import { Switch } from '@/shared/ui';
import { SettingsPage, SettingsSection } from '../../../shared/ui/settings';

export interface ProxyPageProps {
    proxyEnabled: boolean;
    setProxyEnabled: (value: boolean) => void;
    headerName: string;
    setHeaderName: (value: string) => void;
    emailHeaderName: string;
    setEmailHeaderName: (value: string) => void;
    whitelist: string;
    setWhitelist: (value: string) => void;
    overrideLogout: boolean;
    setOverrideLogout: (value: boolean) => void;
    logoutUrl: string;
    setLogoutUrl: (value: string) => void;
}

export const ProxyPage: React.FC<ProxyPageProps> = ({
    proxyEnabled,
    setProxyEnabled,
    headerName,
    setHeaderName,
    emailHeaderName,
    setEmailHeaderName,
    whitelist,
    setWhitelist,
    overrideLogout,
    setOverrideLogout,
    logoutUrl,
    setLogoutUrl
}) => {
    return (
        <SettingsPage
            title="Auth Proxy"
            description="Configure authentication via reverse proxy headers"
        >
            <SettingsSection title="Proxy Configuration" icon={Shield}>
                {/* Proxy Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-theme-tertiary border border-theme">
                    <div>
                        <label className="text-sm font-medium text-theme-primary">
                            Enable Auth Proxy
                        </label>
                        <p className="text-xs text-theme-tertiary mt-1">
                            Enable authentication via reverse proxy headers
                        </p>
                    </div>
                    <Switch
                        checked={proxyEnabled}
                        onCheckedChange={setProxyEnabled}
                    />
                </div>

                {/* Header Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Auth Proxy Header Name"
                        type="text"
                        value={headerName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setHeaderName(e.target.value)}
                        disabled={!proxyEnabled}
                        placeholder="X-Auth-User"
                        helperText="HTTP header containing the username"
                    />
                    <Input
                        label="Auth Proxy Header Name for Email"
                        type="text"
                        value={emailHeaderName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailHeaderName(e.target.value)}
                        disabled={!proxyEnabled}
                        placeholder="X-Auth-Email"
                        helperText="HTTP header containing the user email"
                    />
                </div>

                <Input
                    label="Auth Proxy Whitelist"
                    type="text"
                    value={whitelist}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setWhitelist(e.target.value)}
                    disabled={!proxyEnabled}
                    placeholder="10.0.0.0/8, 172.16.0.0/12"
                    helperText="Trusted proxy source IPs (where auth headers come from) - comma-separated IPs or CIDR ranges"
                />

                {/* Override Logout */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-theme-tertiary border border-theme">
                    <div>
                        <label className="text-sm font-medium text-theme-primary">
                            Override Logout
                        </label>
                        <p className="text-xs text-theme-tertiary mt-1">
                            Redirect to a custom logout URL instead of local logout
                        </p>
                    </div>
                    <Switch
                        checked={overrideLogout}
                        onCheckedChange={setOverrideLogout}
                        disabled={!proxyEnabled}
                    />
                </div>

                {overrideLogout && proxyEnabled && (
                    <Input
                        label="Logout URL"
                        type="text"
                        value={logoutUrl}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setLogoutUrl(e.target.value)}
                        placeholder="https://auth.example.com/logout"
                        helperText="URL to redirect to when user logs out"
                    />
                )}
            </SettingsSection>
        </SettingsPage>
    );
};

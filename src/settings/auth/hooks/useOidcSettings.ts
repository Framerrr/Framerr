/**
 * useOidcSettings Hook
 * Self-contained state management for admin OIDC configuration page.
 * Follows the PlexPage pattern — independent of the shared useAuthSettings hook.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { adminOidcApi } from '../../../api/endpoints/adminOidc';
import { useOidcConfig } from '../../../api/hooks/useSettings';
import { queryKeys } from '../../../api/queryKeys';
import { useNotifications } from '../../../context/NotificationContext';
import { extractErrorMessage } from '../../../api/errors';
import type { OidcConfigResponse, OidcDiscoveryResult } from '../../../api/endpoints/adminOidc';

interface UseOidcSettingsOptions {
    onSaveNeeded?: (hasChanges: boolean) => void;
    onSave?: React.MutableRefObject<(() => Promise<void>) | null>;
}

interface UseOidcSettingsReturn {
    // Form state
    enabled: boolean;
    setEnabled: (v: boolean) => void;
    issuerUrl: string;
    setIssuerUrl: (v: string) => void;
    clientId: string;
    setClientId: (v: string) => void;
    clientSecret: string;
    setClientSecret: (v: string) => void;
    hasClientSecret: boolean;
    displayName: string;
    setDisplayName: (v: string) => void;
    buttonIcon: string;
    setButtonIcon: (v: string) => void;
    scopes: string;
    setScopes: (v: string) => void;
    autoCreateUsers: boolean;
    setAutoCreateUsers: (v: boolean) => void;

    // UI state
    loading: boolean;
    saving: boolean;
    hasChanges: boolean;
    callbackUrl: string;

    // Discovery test
    testing: boolean;
    testResult: OidcDiscoveryResult | null;
    handleTestDiscovery: () => Promise<void>;

    // Save
    handleSave: () => Promise<void>;
}

export function useOidcSettings({ onSaveNeeded, onSave }: UseOidcSettingsOptions = {}): UseOidcSettingsReturn {
    const { success: showSuccess, error: showError, warning: showWarning } = useNotifications();
    const queryClient = useQueryClient();

    // Form state
    const [enabled, setEnabled] = useState(false);
    const [issuerUrl, setIssuerUrl] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [hasClientSecret, setHasClientSecret] = useState(false);
    const [displayName, setDisplayName] = useState('SSO');
    const [buttonIcon, setButtonIcon] = useState('KeyRound');
    const [scopes, setScopes] = useState('openid email profile');
    const [autoCreateUsers, setAutoCreateUsers] = useState(false);

    // Original config for change tracking
    const [originalConfig, setOriginalConfig] = useState<OidcConfigResponse | null>(null);

    // UI state
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<OidcDiscoveryResult | null>(null);

    // Callback URL (computed once)
    const callbackUrl = `${window.location.origin}/api/auth/oidc/callback`;

    // React Query cached config
    const { data: cachedConfig, isPending: loading } = useOidcConfig();

    // Sync form state when React Query data loads
    useEffect(() => {
        if (cachedConfig) {
            setEnabled(cachedConfig.enabled);
            setIssuerUrl(cachedConfig.issuerUrl);
            setClientId(cachedConfig.clientId);
            setHasClientSecret(cachedConfig.clientSecret !== '');
            setClientSecret('');
            setDisplayName(cachedConfig.displayName || 'SSO');
            setButtonIcon(cachedConfig.buttonIcon || 'KeyRound');
            setScopes(cachedConfig.scopes || 'openid email profile');
            setAutoCreateUsers(cachedConfig.autoCreateUsers);
            setOriginalConfig(cachedConfig);
        }
    }, [cachedConfig]);

    // Change tracking
    const hasChanges = originalConfig !== null && (
        enabled !== originalConfig.enabled ||
        issuerUrl !== originalConfig.issuerUrl ||
        clientId !== originalConfig.clientId ||
        clientSecret !== '' || // Any typed secret = change
        displayName !== (originalConfig.displayName || 'SSO') ||
        buttonIcon !== (originalConfig.buttonIcon || 'KeyRound') ||
        scopes !== (originalConfig.scopes || 'openid email profile') ||
        autoCreateUsers !== originalConfig.autoCreateUsers
    );

    // Notify parent about changes
    useEffect(() => {
        onSaveNeeded?.(hasChanges);
    }, [hasChanges, onSaveNeeded]);

    // Discovery test
    const handleTestDiscovery = useCallback(async (): Promise<void> => {
        if (!issuerUrl.trim()) {
            showWarning('Missing Field', 'Enter an Issuer URL before testing');
            return;
        }

        setTesting(true);
        setTestResult(null);

        try {
            const result = await adminOidcApi.testDiscovery(issuerUrl.trim());
            setTestResult(result);

            if (result.success) {
                showSuccess('Discovery Successful', `Connected to ${result.issuerName || issuerUrl}`);
            } else {
                showError('Discovery Failed', result.error || 'Could not reach the OIDC provider');
            }
        } catch (error) {
            showError('Discovery Failed', extractErrorMessage(error));
        } finally {
            setTesting(false);
        }
    }, [issuerUrl, showSuccess, showError, showWarning]);

    // Save
    const handleSave = useCallback(async (): Promise<void> => {
        // Validation
        if (enabled && !issuerUrl.trim()) {
            showWarning('Missing Field', 'Issuer URL is required when OIDC is enabled');
            return;
        }
        if (enabled && !clientId.trim()) {
            showWarning('Missing Field', 'Client ID is required when OIDC is enabled');
            return;
        }
        if (enabled && !hasClientSecret && !clientSecret.trim()) {
            showWarning('Missing Field', 'Client Secret is required when OIDC is enabled');
            return;
        }

        setSaving(true);
        try {
            const updateData: Record<string, unknown> = {
                enabled,
                issuerUrl: issuerUrl.trim(),
                clientId: clientId.trim(),
                displayName: displayName.trim() || 'SSO',
                buttonIcon,
                scopes: scopes.trim() || 'openid email profile',
                autoCreateUsers,
            };

            // Only send client secret if user entered a new one
            if (clientSecret.trim()) {
                updateData.clientSecret = clientSecret.trim();
            }

            const updated = await adminOidcApi.updateConfig(updateData);

            // Sync local state with response
            setEnabled(updated.enabled);
            setIssuerUrl(updated.issuerUrl);
            setClientId(updated.clientId);
            setHasClientSecret(updated.clientSecret !== '');
            setClientSecret('');
            setDisplayName(updated.displayName || 'SSO');
            setButtonIcon(updated.buttonIcon || 'KeyRound');
            setScopes(updated.scopes || 'openid email profile');
            setAutoCreateUsers(updated.autoCreateUsers);
            setOriginalConfig(updated);

            showSuccess('OIDC Saved', 'OpenID Connect configuration updated');

            // Invalidate React Query cache so navigating back shows fresh data
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.oidcConfig() });

            // Notify auth settings changed (for login page SSO button visibility)
            window.dispatchEvent(new CustomEvent('authSettingsUpdated'));
        } catch (error) {
            showError('Save Failed', extractErrorMessage(error));
        } finally {
            setSaving(false);
        }
    }, [enabled, issuerUrl, clientId, clientSecret, hasClientSecret, displayName, buttonIcon, scopes, autoCreateUsers, showSuccess, showError, showWarning]);

    // Register save ref for parent delegation — must update on every handleSave change
    useEffect(() => {
        if (onSave) {
            onSave.current = handleSave;
        }
        return () => {
            if (onSave) {
                onSave.current = null;
            }
        };
    }, [onSave, handleSave]);

    return {
        enabled, setEnabled,
        issuerUrl, setIssuerUrl,
        clientId, setClientId,
        clientSecret, setClientSecret,
        hasClientSecret,
        displayName, setDisplayName,
        buttonIcon, setButtonIcon,
        scopes, setScopes,
        autoCreateUsers, setAutoCreateUsers,
        loading, saving, hasChanges,
        callbackUrl,
        testing, testResult, handleTestDiscovery,
        handleSave,
    };
}

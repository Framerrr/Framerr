/**
 * Admin OIDC API Endpoints
 * Admin-only endpoints for managing OpenID Connect SSO configuration
 */
import { api } from '../client';

export interface OidcConfigResponse {
    enabled: boolean;
    issuerUrl: string;
    clientId: string;
    clientSecret: string; // '••••••••' when set, '' when empty
    displayName: string;
    buttonIcon: string;
    scopes: string;
    autoCreateUsers: boolean;
}

export interface OidcConfigUpdateData {
    enabled?: boolean;
    issuerUrl?: string;
    clientId?: string;
    clientSecret?: string;
    displayName?: string;
    buttonIcon?: string;
    scopes?: string;
    autoCreateUsers?: boolean;
}

export interface OidcDiscoveryResult {
    success: boolean;
    issuerName?: string;
    authorizationEndpoint?: string;
    tokenEndpoint?: string;
    userinfoEndpoint?: string;
    error?: string;
}

export const adminOidcApi = {
    /**
     * Get OIDC configuration (client secret redacted)
     */
    getConfig: () =>
        api.get<OidcConfigResponse>('/api/admin/oidc'),

    /**
     * Update OIDC configuration
     */
    updateConfig: (data: OidcConfigUpdateData) =>
        api.put<OidcConfigResponse>('/api/admin/oidc', data),

    /**
     * Test OIDC discovery for a given issuer URL
     */
    testDiscovery: (issuerUrl: string) =>
        api.post<OidcDiscoveryResult>('/api/admin/oidc/test', { issuerUrl }),
};

export default adminOidcApi;

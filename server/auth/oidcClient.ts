/**
 * OIDC Client Module
 * 
 * Core OpenID Connect implementation using openid-client v6.
 * Handles PKCE authorization code flow with full security:
 * - PKCE S256 code challenge
 * - State parameter (CSRF prevention)
 * - Nonce validation (replay prevention)
 * - ID Token signature/iss/aud/exp validation (via openid-client)
 * - UserInfo endpoint enrichment
 * - BFF pattern (tokens never reach browser)
 */
import * as client from 'openid-client';
import { getOidcConfig } from '../db/oidcConfig';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/** Stored per authorization request — maps state → auth params */
interface AuthState {
    codeVerifier: string;
    nonce: string;
    redirectUri: string;
    createdAt: number;
    /** Only set during account-linking flow */
    userId?: string;
}

/** Claims extracted from ID Token + UserInfo */
export interface OidcClaims {
    sub: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
    preferredUsername?: string;
    picture?: string;
}

/** Discovery test result for admin UI */
export interface DiscoveryTestResult {
    success: boolean;
    issuerName?: string;
    authorizationEndpoint?: string;
    tokenEndpoint?: string;
    userinfoEndpoint?: string;
    error?: string;
}

/** Typed OIDC error with machine-readable code for route-layer error handling */
export class OidcError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'OidcError';
    }
}

// ============================================================================
// In-Memory State Store
// ============================================================================

const authStates = new Map<string, AuthState>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup expired states every 5 minutes
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [state, data] of authStates) {
        if (now - data.createdAt > STATE_TTL_MS) {
            authStates.delete(state);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        logger.debug(`[OIDC] Cleaned ${cleaned} expired auth states`);
    }
}, 5 * 60 * 1000);

// ============================================================================
// Configuration Cache
// ============================================================================

let cachedConfig: client.Configuration | null = null;
let cachedConfigAt = 0;
const CONFIG_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get or create the openid-client Configuration (with discovery).
 * Caches for 1 hour. Call clearCache() when admin updates config.
 */
async function getConfiguration(): Promise<client.Configuration> {
    const now = Date.now();

    // Return cached if still valid
    if (cachedConfig && (now - cachedConfigAt) < CONFIG_CACHE_TTL_MS) {
        return cachedConfig;
    }

    const config = getOidcConfig();

    if (!config.issuerUrl || !config.clientId) {
        throw new OidcError('not_configured', 'OIDC not configured: missing issuer URL or client ID');
    }

    logger.debug(`[OIDC] Performing discovery: issuer="${config.issuerUrl}"`);

    const issuerUrl = new URL(config.issuerUrl);

    // discovery() performs .well-known/openid-configuration fetch
    // and validates that the issuer in metadata matches the URL
    try {
        cachedConfig = await client.discovery(
            issuerUrl,
            config.clientId,
            config.clientSecret || undefined // undefined = public client (no secret)
        );
    } catch (discErr) {
        throw new OidcError('discovery_failed', `Failed to discover OIDC provider at ${config.issuerUrl}: ${(discErr as Error).message}`);
    }

    cachedConfigAt = now;

    logger.info(`[OIDC] Discovery complete: issuer="${config.issuerUrl}"`);

    return cachedConfig;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build an authorization URL with full PKCE + state + nonce.
 * 
 * @param callbackUrl - The callback URL registered with the IdP
 * @param userId - If set, this is an account-linking flow (not login)
 * @returns The authorization URL the browser should redirect to, plus the state for reference
 */
export async function buildAuthorizationUrl(
    callbackUrl: string,
    userId?: string
): Promise<{ url: string; state: string }> {
    const configuration = await getConfiguration();
    const config = getOidcConfig();

    // Generate unique PKCE, state, and nonce for this request
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    // Store auth state server-side (never exposed to browser)
    authStates.set(state, {
        codeVerifier,
        nonce,
        redirectUri: callbackUrl,
        createdAt: Date.now(),
        userId,
    });

    // Build the authorization URL
    const redirectTo = client.buildAuthorizationUrl(configuration, {
        redirect_uri: callbackUrl,
        scope: config.scopes || 'openid email profile',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce,
        response_type: 'code',
    });

    logger.debug(`[OIDC] Authorization URL built: state=${state.substring(0, 8)}...`);

    return {
        url: redirectTo.href,
        state,
    };
}

/**
 * Handle the authorization callback — validate state, exchange code, validate tokens.
 * 
 * @param currentUrl - The full callback URL with query parameters from the IdP
 * @param state - The state parameter from the callback (used to look up auth state)
 * @returns Validated OIDC claims and optional userId (for linking flow)
 */
export async function handleCallback(
    currentUrl: URL,
    state: string
): Promise<{ claims: OidcClaims; userId?: string }> {
    // Look up and consume the auth state (single-use)
    const authState = authStates.get(state);
    if (!authState) {
        throw new OidcError('state_invalid', 'Invalid or expired authorization state. Please try again.');
    }

    // Delete immediately — single-use (prevents replay)
    authStates.delete(state);

    // Check TTL
    if (Date.now() - authState.createdAt > STATE_TTL_MS) {
        throw new OidcError('state_expired', 'Authorization request expired. Please try again.');
    }

    const configuration = await getConfiguration();

    // Exchange authorization code for tokens
    // openid-client validates: state match, PKCE, nonce in ID Token,
    // ID Token signature (via JWKS), iss, aud, exp
    //
    // Use the stored redirectUri (from login step) as the base of currentUrl.
    // The callback is a browser redirect (no Origin header), so we can't
    // reconstruct the URL from request headers reliably.
    const storedRedirectUrl = new URL(authState.redirectUri);
    storedRedirectUrl.search = currentUrl.search;

    const tokenResponse = await client.authorizationCodeGrant(
        configuration,
        storedRedirectUrl,
        {
            pkceCodeVerifier: authState.codeVerifier,
            expectedState: state,
            expectedNonce: authState.nonce,
            idTokenExpected: true,
        }
    );

    // Extract claims from the validated ID Token
    const idTokenClaims = tokenResponse.claims();
    if (!idTokenClaims) {
        throw new OidcError('missing_claims', 'No ID Token claims received from provider');
    }

    const sub = idTokenClaims.sub;
    if (!sub) {
        throw new OidcError('missing_claims', 'ID Token missing required "sub" claim');
    }

    // Start with ID Token claims
    const claims: OidcClaims = {
        sub,
        email: idTokenClaims.email as string | undefined,
        emailVerified: idTokenClaims.email_verified as boolean | undefined,
        name: idTokenClaims.name as string | undefined,
        preferredUsername: idTokenClaims.preferred_username as string | undefined,
        picture: idTokenClaims.picture as string | undefined,
    };

    // Enrich with UserInfo if available (some IdPs return minimal ID Token claims)
    try {
        const userInfo = await client.fetchUserInfo(
            configuration,
            tokenResponse.access_token,
            sub // expectedSubject — prevents subject switching
        );

        // Merge UserInfo claims (prefer UserInfo over ID Token for profile data)
        if (userInfo.email && !claims.email) claims.email = userInfo.email as string;
        if (userInfo.email_verified !== undefined && claims.emailVerified === undefined) {
            claims.emailVerified = userInfo.email_verified as boolean;
        }
        if (userInfo.name && !claims.name) claims.name = userInfo.name as string;
        if (userInfo.preferred_username && !claims.preferredUsername) {
            claims.preferredUsername = userInfo.preferred_username as string;
        }
        if (userInfo.picture && !claims.picture) claims.picture = userInfo.picture as string;
    } catch (error) {
        // UserInfo is optional — some providers don't support it
        logger.debug(`[OIDC] UserInfo fetch skipped: error="${(error as Error).message}"`);
    }

    logger.info(`[OIDC] Callback processed: sub="${sub}" email="${claims.email || 'none'}" name="${claims.preferredUsername || claims.name || 'none'}"`);

    return {
        claims,
        userId: authState.userId,
    };
}

/**
 * Test OIDC discovery for an issuer URL.
 * Used by admin to validate configuration before saving.
 */
export async function testDiscovery(issuerUrl: string): Promise<DiscoveryTestResult> {
    try {
        const url = new URL(issuerUrl);

        // Use a dummy client ID for discovery test — we only need server metadata
        const testConfig = await client.discovery(url, '_test_');

        // Access the server metadata
        const serverMeta = testConfig.serverMetadata();

        return {
            success: true,
            issuerName: (serverMeta.issuer || issuerUrl).toString(),
            authorizationEndpoint: serverMeta.authorization_endpoint,
            tokenEndpoint: serverMeta.token_endpoint,
            userinfoEndpoint: serverMeta.userinfo_endpoint,
        };
    } catch (error) {
        const message = (error as Error).message;
        logger.warn(`[OIDC] Discovery test failed: issuer="${issuerUrl}" error="${message}"`);

        return {
            success: false,
            error: message,
        };
    }
}

/**
 * Clear the cached Configuration.
 * Call this when admin updates OIDC settings so the next request re-discovers.
 */
export function clearCache(): void {
    cachedConfig = null;
    cachedConfigAt = 0;
    logger.debug('[OIDC] Configuration cache cleared');
}

/**
 * OIDC Configuration Database Module
 * 
 * Manages the singleton oidc_config table for OpenID Connect SSO settings.
 * Client secret is encrypted at rest using the field-level encryption utility.
 */
import { getDb } from '../database/db';
import { encrypt, decrypt } from '../utils/encryption';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface OidcConfigRow {
    id: number;
    enabled: number;
    issuer_url: string;
    client_id: string;
    client_secret: string;
    display_name: string;
    button_icon: string;
    scopes: string;
    auto_create_users: number;
    created_at: number;
    updated_at: number;
}

export interface OidcConfig {
    enabled: boolean;
    issuerUrl: string;
    clientId: string;
    clientSecret: string;
    displayName: string;
    buttonIcon: string;
    scopes: string;
    autoCreateUsers: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface OidcConfigRedacted {
    enabled: boolean;
    issuerUrl: string;
    clientId: string;
    clientSecret: string; // Always '••••••••' or empty
    displayName: string;
    buttonIcon: string;
    scopes: string;
    autoCreateUsers: boolean;
}

export interface OidcConfigUpdate {
    enabled?: boolean;
    issuerUrl?: string;
    clientId?: string;
    clientSecret?: string;
    displayName?: string;
    buttonIcon?: string;
    scopes?: string;
    autoCreateUsers?: boolean;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Get OIDC config with client secret DECRYPTED.
 * For server-side use only — never expose to frontend.
 */
export function getOidcConfig(): OidcConfig {
    const row = getDb().prepare('SELECT * FROM oidc_config WHERE id = 1').get() as OidcConfigRow | undefined;

    if (!row) {
        // Should never happen — migration inserts default row
        return {
            enabled: false,
            issuerUrl: '',
            clientId: '',
            clientSecret: '',
            displayName: 'SSO',
            buttonIcon: 'KeyRound',
            scopes: 'openid email profile',
            autoCreateUsers: false,
            createdAt: 0,
            updatedAt: 0,
        };
    }

    let decryptedSecret = '';
    if (row.client_secret) {
        try {
            decryptedSecret = decrypt(row.client_secret);
        } catch (error) {
            logger.error(`[OidcConfig] Failed to decrypt client secret: error="${(error as Error).message}"`);
            // Return empty — admin will need to re-enter
        }
    }

    return {
        enabled: row.enabled === 1,
        issuerUrl: row.issuer_url,
        clientId: row.client_id,
        clientSecret: decryptedSecret,
        displayName: row.display_name,
        buttonIcon: row.button_icon || 'KeyRound',
        scopes: row.scopes,
        autoCreateUsers: row.auto_create_users === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * Get OIDC config with client secret REDACTED.
 * Safe for admin API responses.
 */
export function getOidcConfigRedacted(): OidcConfigRedacted {
    const config = getOidcConfig();

    return {
        enabled: config.enabled,
        issuerUrl: config.issuerUrl,
        clientId: config.clientId,
        clientSecret: config.clientSecret ? '••••••••' : '',
        displayName: config.displayName,
        buttonIcon: config.buttonIcon,
        scopes: config.scopes,
        autoCreateUsers: config.autoCreateUsers,
    };
}

/**
 * Update OIDC config.
 * Encrypts clientSecret if provided and non-empty.
 */
export function updateOidcConfig(data: OidcConfigUpdate): OidcConfig {
    const now = Math.floor(Date.now() / 1000);
    const current = getOidcConfig();

    // Build update — only change fields that are provided
    const enabled = data.enabled !== undefined ? data.enabled : current.enabled;
    const issuerUrl = data.issuerUrl !== undefined ? data.issuerUrl : current.issuerUrl;
    const clientId = data.clientId !== undefined ? data.clientId : current.clientId;
    const displayName = data.displayName !== undefined ? data.displayName : current.displayName;
    const buttonIcon = data.buttonIcon !== undefined ? data.buttonIcon : current.buttonIcon;
    const scopes = data.scopes !== undefined ? data.scopes : current.scopes;
    const autoCreateUsers = data.autoCreateUsers !== undefined ? data.autoCreateUsers : current.autoCreateUsers;

    // Handle client secret — encrypt if new value provided, keep existing if not
    let encryptedSecret: string;
    if (data.clientSecret !== undefined && data.clientSecret !== '' && data.clientSecret !== '••••••••') {
        // New secret provided — encrypt it
        encryptedSecret = encrypt(data.clientSecret);
        logger.debug('[OidcConfig] Client secret updated and encrypted');
    } else {
        // Keep existing encrypted value from DB (don't re-encrypt)
        const row = getDb().prepare('SELECT client_secret FROM oidc_config WHERE id = 1').get() as { client_secret: string } | undefined;
        encryptedSecret = row?.client_secret || '';
    }

    getDb().prepare(`
        UPDATE oidc_config SET
            enabled = ?,
            issuer_url = ?,
            client_id = ?,
            client_secret = ?,
            display_name = ?,
            button_icon = ?,
            scopes = ?,
            auto_create_users = ?,
            updated_at = ?
        WHERE id = 1
    `).run(
        enabled ? 1 : 0,
        issuerUrl,
        clientId,
        encryptedSecret,
        displayName,
        buttonIcon,
        scopes,
        autoCreateUsers ? 1 : 0,
        now
    );

    logger.info(`[OidcConfig] Updated: enabled=${enabled} issuer="${issuerUrl}" autoCreate=${autoCreateUsers}`);

    return getOidcConfig();
}

/**
 * Quick check if OIDC is enabled and properly configured.
 */
export function isOidcEnabled(): boolean {
    try {
        const row = getDb().prepare(
            'SELECT enabled, issuer_url, client_id FROM oidc_config WHERE id = 1'
        ).get() as { enabled: number; issuer_url: string; client_id: string } | undefined;

        if (!row) return false;

        // Must be enabled AND have required fields
        return row.enabled === 1 && !!row.issuer_url && !!row.client_id;
    } catch {
        return false;
    }
}

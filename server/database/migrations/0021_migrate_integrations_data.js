/**
 * Migration: Migrate integrations data from systemConfig to integration_instances table
 * Purpose: Transfer existing single-instance integrations to new multi-instance model
 * Version: 21
 * 
 * This migration reads the integrations JSON blob from system_config and creates
 * individual rows in integration_instances for each configured service.
 * 
 * NOTE: In development mode, encryption is bypassed (plaintext storage).
 * In production, config_encrypted will contain AES-256-GCM encrypted JSON.
 */

const crypto = require('crypto');
const logger = require('../../utils/logger').default;

// Encryption settings (must match server/utils/encryption.ts)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Encrypt config for storage.
 * In development, returns JSON string directly.
 * In production, encrypts with AES-256-GCM.
 */
function encryptConfig(config, isDev) {
    const jsonStr = JSON.stringify(config);

    if (isDev) {
        return jsonStr;
    }

    const keyHex = process.env.SECRET_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        // In migration, just store as plaintext if no key
        // (production startup would have already exited if key was missing)
        return jsonStr;
    }

    const key = Buffer.from(keyHex, 'hex');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(jsonStr, 'utf8'),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString('base64');
}

/**
 * Generate display name from integration type.
 */
function getDisplayName(type) {
    const names = {
        'plex': 'Plex',
        'sonarr': 'Sonarr',
        'radarr': 'Radarr',
        'overseerr': 'Overseerr',
        'qbittorrent': 'qBittorrent',
        'systemstatus': 'System Status',
        'servicemonitoring': 'Service Monitoring'
    };
    return names[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

module.exports = {
    version: 21,
    name: 'migrate_integrations_data',
    up(db) {
        const isDev = process.env.NODE_ENV === 'development';

        // Check if migration already ran (idempotent)
        const existingCount = db.prepare(`SELECT COUNT(*) as count FROM integration_instances`).get();
        if (existingCount.count > 0) {
            logger.debug('[Migration 0021] integration_instances already has data, skipping migration');
            return;
        }

        // Get integrations from system_config
        const row = db.prepare(`SELECT value FROM system_config WHERE key = 'integrations'`).get();

        if (!row || !row.value) {
            logger.debug('[Migration 0021] No integrations found in system_config');
            return;
        }

        let integrations;
        try {
            integrations = JSON.parse(row.value);
        } catch (error) {
            logger.debug('[Migration 0021] Failed to parse integrations JSON:', { error: error.message });
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        let migrated = 0;
        let skipped = 0;

        const insert = db.prepare(`
            INSERT INTO integration_instances (id, type, display_name, config_encrypted, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL)
        `);

        for (const [type, config] of Object.entries(integrations)) {
            // Skip if not enabled or no config
            if (!config || typeof config !== 'object') {
                skipped++;
                continue;
            }

            // Extract config without the 'sharing' field (handled by widget_shares in Phase 4)
            const { sharing: _sharing, ...configWithoutSharing } = config;

            // Skip empty configs
            if (Object.keys(configWithoutSharing).length === 0) {
                skipped++;
                continue;
            }

            const id = `${type}-primary`;
            const displayName = getDisplayName(type);
            const configEncrypted = encryptConfig(configWithoutSharing, isDev);
            const enabled = configWithoutSharing.enabled !== false ? 1 : 0;

            try {
                insert.run(id, type, displayName, configEncrypted, enabled, now);
                migrated++;
                logger.debug('[Migration 0021] Migrated integration', { type, id });
            } catch (error) {
                logger.debug('[Migration 0021] Failed to migrate integration', { type, error: error.message });
                skipped++;
            }
        }

        logger.debug('[Migration 0021] Complete', { migrated, skipped });
    }
};

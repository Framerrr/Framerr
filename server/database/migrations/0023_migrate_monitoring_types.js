/**
 * Migration: Migrate monitoring to new integration types
 * Purpose: Transform systemstatus -> glances, create monitor instance
 * Version: 23
 * 
 * This migration:
 * 1. Transforms existing 'systemstatus-primary' -> 'glances-primary' with flat config
 * 2. Creates 'monitor-primary' integration instance
 * 3. Assigns all existing service_monitors to monitor-primary
 * 
 * NOTE: In development mode, encryption is bypassed (plaintext storage).
 */

const crypto = require('crypto');
const logger = require('../../utils/logger').default;

// Encryption settings (must match server/utils/encryption.ts)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Encrypt config for storage.
 */
function encryptConfig(config, isDev) {
    const jsonStr = JSON.stringify(config);

    if (isDev) {
        return jsonStr;
    }

    const keyHex = process.env.SECRET_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
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
 * Decrypt config from storage.
 */
function decryptConfig(encryptedStr, isDev) {
    if (isDev) {
        try {
            return JSON.parse(encryptedStr);
        } catch {
            return {};
        }
    }

    const keyHex = process.env.SECRET_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        try {
            return JSON.parse(encryptedStr);
        } catch {
            return {};
        }
    }

    try {
        const key = Buffer.from(keyHex, 'hex');
        const combined = Buffer.from(encryptedStr, 'base64');

        const iv = combined.subarray(0, IV_LENGTH);
        const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + 16);
        const encrypted = combined.subarray(IV_LENGTH + 16);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        return JSON.parse(decrypted.toString('utf8'));
    } catch {
        return {};
    }
}

module.exports = {
    version: 23,
    name: 'migrate_monitoring_to_new_types',
    up(db) {
        const isDev = process.env.NODE_ENV === 'development';
        const now = Math.floor(Date.now() / 1000);

        // =========================================================================
        // Step 1: Transform systemstatus -> glances (if exists)
        // =========================================================================
        const systemstatusRow = db.prepare(`
            SELECT id, config_encrypted, enabled FROM integration_instances WHERE type = 'systemstatus'
        `).get();

        if (systemstatusRow) {
            // Decrypt existing config
            const oldConfig = decryptConfig(systemstatusRow.config_encrypted, isDev);

            // Extract glances config from nested structure
            // Old: { backend: 'glances', glances: { url, password }, enabled: true }
            // New: { url, password }
            let newConfig = {};
            if (oldConfig.backend === 'glances' && oldConfig.glances) {
                newConfig = {
                    url: oldConfig.glances.url || '',
                    password: oldConfig.glances.password || ''
                };
            } else if (oldConfig.backend === 'custom' && oldConfig.custom) {
                newConfig = {
                    url: oldConfig.custom.url || '',
                    token: oldConfig.custom.token || ''
                };
            }

            // Create new glances integration
            const glancesId = 'glances-primary';
            const newConfigEncrypted = encryptConfig(newConfig, isDev);

            try {
                db.prepare(`
                    INSERT INTO integration_instances (id, type, display_name, config_encrypted, enabled, created_at, updated_at)
                    VALUES (?, 'glances', 'Glances', ?, ?, ?, NULL)
                `).run(glancesId, newConfigEncrypted, systemstatusRow.enabled, now);

                logger.debug('[Migration 0023] Created glances-primary from systemstatus-primary');
            } catch (error) {
                // May already exist
                logger.debug('[Migration 0023] glances-primary may already exist', { error: error.message });
            }

            // Delete old systemstatus instance
            db.prepare(`DELETE FROM integration_instances WHERE id = ?`).run(systemstatusRow.id);
            logger.debug('[Migration 0023] Removed systemstatus-primary');
        }

        // =========================================================================
        // Step 2: Create framerr-monitoring instance (if not exists)
        // =========================================================================
        const existingMonitor = db.prepare(`
            SELECT id FROM integration_instances WHERE id = 'monitor-primary'
        `).get();

        if (!existingMonitor) {
            // Check if there's an existing servicemonitoring config to determine enabled state
            const servicemonitoringRow = db.prepare(`
                SELECT enabled FROM integration_instances WHERE type = 'servicemonitoring'
            `).get();

            const enabled = servicemonitoringRow ? servicemonitoringRow.enabled : 1;

            // monitor has minimal config (monitors are in service_monitors table)
            const monitorConfig = { label: 'Primary Monitors' };
            const configEncrypted = encryptConfig(monitorConfig, isDev);

            db.prepare(`
                INSERT INTO integration_instances (id, type, display_name, config_encrypted, enabled, created_at, updated_at)
                VALUES ('monitor-primary', 'monitor', 'Service Monitor', ?, ?, ?, NULL)
            `).run(configEncrypted, enabled, now);

            logger.debug('[Migration 0023] Created monitor-primary');

            // Remove old servicemonitoring instance if it exists
            if (servicemonitoringRow) {
                db.prepare(`DELETE FROM integration_instances WHERE type = 'servicemonitoring'`).run();
                logger.debug('[Migration 0023] Removed servicemonitoring-primary');
            }
        }

        // =========================================================================
        // Step 3: Assign all existing monitors to monitor-primary
        // =========================================================================
        const updateResult = db.prepare(`
            UPDATE service_monitors 
            SET integration_instance_id = 'monitor-primary'
            WHERE integration_instance_id IS NULL
        `).run();

        logger.debug('[Migration 0023] Assigned monitors to monitor-primary', { count: updateResult.changes });

        logger.debug('[Migration 0023] Complete: Monitoring architecture migrated to new types');
    }
};

/**
 * Migration: Refactor integration_shares for instance-based sharing
 * Purpose: Change integration_shares from type-based to instance-based sharing
 * Version: 26
 * 
 * Changes:
 * - Add integration_instance_id column
 * - Migrate existing integration_name shares to instance-based shares
 * - Create new unique index
 * 
 * This supports the new dual-table sharing model:
 * - widget_shares: Controls access to widget TYPES
 * - integration_shares: Controls access to integration INSTANCES
 */
const logger = require('../../utils/logger').default;

module.exports = {
    version: 26,
    name: 'refactor_integration_shares_for_instances',
    up(db) {
        // =========================================================================
        // Step 1: Add integration_instance_id column
        // =========================================================================
        logger.debug('[Migration 0026] Adding integration_instance_id column...');

        db.exec(`
            ALTER TABLE integration_shares 
            ADD COLUMN integration_instance_id TEXT;
        `);

        // =========================================================================
        // Step 2: Migrate existing shares (type-based) to instance-based
        // For each share by integration_name (type), create shares for all instances
        // =========================================================================
        logger.debug('[Migration 0026] Migrating existing type-based shares to instance-based...');

        // Get all existing shares
        const existingShares = db.prepare(`
            SELECT id, integration_name, share_type, share_target, shared_by, created_at
            FROM integration_shares
            WHERE integration_instance_id IS NULL
        `).all();

        // Get all integration instances
        const instances = db.prepare(`
            SELECT id, type FROM integration_instances
        `).all();

        // Create a map of type -> instances
        const instancesByType = new Map();
        for (const instance of instances) {
            if (!instancesByType.has(instance.type)) {
                instancesByType.set(instance.type, []);
            }
            instancesByType.get(instance.type).push(instance.id);
        }

        // UUID generator (simple version for migration)
        const generateId = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        let migratedCount = 0;
        let deletedCount = 0;

        for (const share of existingShares) {
            const typeInstances = instancesByType.get(share.integration_name) || [];

            if (typeInstances.length === 0) {
                // No instances of this type - delete orphaned share
                db.prepare(`DELETE FROM integration_shares WHERE id = ?`).run(share.id);
                deletedCount++;
                continue;
            }

            // For each instance of this type, either update the original or create new
            for (let i = 0; i < typeInstances.length; i++) {
                const instanceId = typeInstances[i];

                if (i === 0) {
                    // Update the original share with first instance
                    db.prepare(`
                        UPDATE integration_shares 
                        SET integration_instance_id = ?
                        WHERE id = ?
                    `).run(instanceId, share.id);
                } else {
                    // Create new share for additional instances
                    db.prepare(`
                        INSERT OR IGNORE INTO integration_shares 
                        (id, integration_name, integration_instance_id, share_type, share_target, shared_by, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        generateId(),
                        share.integration_name,
                        instanceId,
                        share.share_type,
                        share.share_target,
                        share.shared_by,
                        share.created_at
                    );
                }
                migratedCount++;
            }
        }

        logger.debug('[Migration 0026] Share migration complete', { migrated: migratedCount, deleted: deletedCount });

        // =========================================================================
        // Step 3: Create index on integration_instance_id
        // =========================================================================
        logger.debug('[Migration 0026] Creating index on integration_instance_id...');

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_integration_shares_instance_id 
            ON integration_shares(integration_instance_id);
        `);

        // =========================================================================
        // Step 4: Create new unique constraint (instance-based)
        // =========================================================================
        logger.debug('[Migration 0026] Creating unique constraint for instance-based shares...');

        // Can't modify existing unique index, so create a new one with different name
        db.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_shares_instance_unique 
            ON integration_shares(integration_instance_id, share_type, share_target);
        `);

        logger.debug('[Migration 0026] Complete: integration_shares now supports instance-based sharing');
    }
};

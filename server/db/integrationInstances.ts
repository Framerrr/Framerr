/**
 * Integration Instances Database Layer
 * 
 * CRUD operations for the integration_instances table.
 * Each row represents a single integration instance (e.g., "Radarr - 4K Movies").
 * Credentials are encrypted at rest using AES-256-GCM.
 */

import { getDb } from '../database/db';
import { encrypt, decrypt } from '../utils/encryption';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Integration instance as stored in database (encrypted).
 */
interface IntegrationInstanceRow {
    id: string;
    type: string;
    display_name: string;
    config_encrypted: string;
    enabled: number;
    created_at: number;
    updated_at: number | null;
}

/**
 * Integration instance with decrypted config (returned to callers).
 */
export interface IntegrationInstance {
    id: string;
    type: string;
    displayName: string;
    config: Record<string, unknown>;
    enabled: boolean;
    createdAt: string;
    updatedAt: string | null;
}

/**
 * Data required to create a new integration instance.
 */
export interface IntegrationInstanceCreate {
    type: string;
    displayName: string;
    config: Record<string, unknown>;
    enabled?: boolean;
}

/**
 * Data for updating an existing integration instance.
 */
export interface IntegrationInstanceUpdate {
    displayName?: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert database row to IntegrationInstance (decrypts config).
 */
function rowToInstance(row: IntegrationInstanceRow): IntegrationInstance {
    let config: Record<string, unknown> = {};

    try {
        const decrypted = decrypt(row.config_encrypted);
        config = JSON.parse(decrypted);
    } catch (error) {
        logger.error(`[IntegrationInstances] Failed to decrypt config: id=${row.id} error="${(error as Error).message}"`);
        // Return empty config on decryption failure
    }

    return {
        id: row.id,
        type: row.type,
        displayName: row.display_name,
        config,
        enabled: row.enabled === 1,
        createdAt: new Date(row.created_at * 1000).toISOString(),
        updatedAt: row.updated_at ? new Date(row.updated_at * 1000).toISOString() : null
    };
}

/**
 * Generate a unique ID for an integration instance.
 * Format: {type}-{short-uuid} (e.g., "radarr-a1b2c3d4")
 */
function generateInstanceId(type: string): string {
    const shortId = uuidv4().substring(0, 8);
    return `${type}-${shortId}`;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get all integration instances.
 */
export function getAllInstances(): IntegrationInstance[] {
    const db = getDb();
    const rows = db.prepare(`
        SELECT id, type, display_name, config_encrypted, enabled, created_at, updated_at
        FROM integration_instances
        ORDER BY type, display_name
    `).all() as IntegrationInstanceRow[];

    return rows.map(rowToInstance);
}

/**
 * Get integration instances by type.
 */
export function getInstancesByType(type: string): IntegrationInstance[] {
    const db = getDb();
    const rows = db.prepare(`
        SELECT id, type, display_name, config_encrypted, enabled, created_at, updated_at
        FROM integration_instances
        WHERE type = ?
        ORDER BY display_name
    `).all(type) as IntegrationInstanceRow[];

    return rows.map(rowToInstance);
}

/**
 * Get a single integration instance by ID.
 */
export function getInstanceById(id: string): IntegrationInstance | null {
    const db = getDb();
    const row = db.prepare(`
        SELECT id, type, display_name, config_encrypted, enabled, created_at, updated_at
        FROM integration_instances
        WHERE id = ?
    `).get(id) as IntegrationInstanceRow | undefined;

    return row ? rowToInstance(row) : null;
}

/**
 * Get the first enabled instance of a given type.
 * Useful for widgets that just need "the" integration of a type.
 */
export function getFirstEnabledByType(type: string): IntegrationInstance | null {
    const db = getDb();
    const row = db.prepare(`
        SELECT id, type, display_name, config_encrypted, enabled, created_at, updated_at
        FROM integration_instances
        WHERE type = ? AND enabled = 1
        ORDER BY created_at ASC
        LIMIT 1
    `).get(type) as IntegrationInstanceRow | undefined;

    return row ? rowToInstance(row) : null;
}

/**
 * Create a new integration instance.
 */
export function createInstance(data: IntegrationInstanceCreate): IntegrationInstance {
    const db = getDb();
    const id = generateInstanceId(data.type);
    const configEncrypted = encrypt(JSON.stringify(data.config));
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
        INSERT INTO integration_instances (id, type, display_name, config_encrypted, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL)
    `).run(id, data.type, data.displayName, configEncrypted, data.enabled !== false ? 1 : 0, now);

    logger.info(`[IntegrationInstances] Created: id=${id} type=${data.type} name="${data.displayName}"`);

    return getInstanceById(id)!;
}

/**
 * Update an existing integration instance.
 */
export function updateInstance(id: string, data: IntegrationInstanceUpdate): IntegrationInstance | null {
    const db = getDb();
    const existing = getInstanceById(id);

    if (!existing) {
        return null;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.displayName !== undefined) {
        updates.push('display_name = ?');
        params.push(data.displayName);
    }

    if (data.config !== undefined) {
        updates.push('config_encrypted = ?');
        params.push(encrypt(JSON.stringify(data.config)));
    }

    if (data.enabled !== undefined) {
        updates.push('enabled = ?');
        params.push(data.enabled ? 1 : 0);
    }

    if (updates.length === 0) {
        return existing;
    }

    updates.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));
    params.push(id);

    db.prepare(`
        UPDATE integration_instances
        SET ${updates.join(', ')}
        WHERE id = ?
    `).run(...params);

    logger.info(`[IntegrationInstances] Updated: id=${id} fields=[${Object.keys(data).join(',')}]`);

    return getInstanceById(id);
}

/**
 * Delete an integration instance.
 * Also deletes associated service_monitors (cascade).
 */
export function deleteInstance(id: string): boolean {
    const db = getDb();

    // First, delete any service_monitors associated with this instance
    const monitorsDeleted = db.prepare(`DELETE FROM service_monitors WHERE integration_instance_id = ?`).run(id);
    if (monitorsDeleted.changes > 0) {
        logger.info(`[IntegrationInstances] Cascade deleted monitors: instance=${id} count=${monitorsDeleted.changes}`);
    }

    // Then delete the instance itself
    const result = db.prepare(`DELETE FROM integration_instances WHERE id = ?`).run(id);

    if (result.changes > 0) {
        logger.info(`[IntegrationInstances] Deleted: id=${id}`);
        return true;
    }

    return false;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if any instances exist for a given type.
 */
export function hasInstancesOfType(type: string): boolean {
    const db = getDb();
    const row = db.prepare(`SELECT COUNT(*) as count FROM integration_instances WHERE type = ?`).get(type) as { count: number };
    return row.count > 0;
}

/**
 * Get count of all instances.
 */
export function getInstanceCount(): number {
    const db = getDb();
    const row = db.prepare(`SELECT COUNT(*) as count FROM integration_instances`).get() as { count: number };
    return row.count;
}

/**
 * Get enabled integration types (for widget gallery).
 */
export function getEnabledTypes(): string[] {
    const db = getDb();
    const rows = db.prepare(`
        SELECT DISTINCT type FROM integration_instances WHERE enabled = 1
    `).all() as { type: string }[];

    return rows.map(r => r.type);
}

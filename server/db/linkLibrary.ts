import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// === Types ===

interface LinkLibraryRow {
    id: string;
    user_id: string;
    title: string;
    icon: string;
    size: string;
    type: string;
    url: string;
    style: string;
    action: string | null;
    created_at: number;
    updated_at: number;
}

export interface LinkLibraryEntry {
    id: string;
    userId: string;
    title: string;
    icon: string;
    size: 'circle' | 'rectangle';
    type: 'link' | 'action';
    url: string;
    style: { showIcon?: boolean; showText?: boolean };
    action: { method: string; url: string; headers?: Record<string, string>; body?: unknown } | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateLinkData {
    title: string;
    icon: string;
    size: string;
    type: string;
    url?: string;
    style?: { showIcon?: boolean; showText?: boolean };
    action?: { method: string; url: string; headers?: Record<string, string>; body?: unknown } | null;
}

// === Row → Entry conversion ===

function rowToEntry(row: LinkLibraryRow): LinkLibraryEntry {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        icon: row.icon,
        size: row.size as 'circle' | 'rectangle',
        type: row.type as 'link' | 'action',
        url: row.url,
        style: row.style ? JSON.parse(row.style) : {},
        action: row.action ? JSON.parse(row.action) : null,
        createdAt: new Date(row.created_at * 1000).toISOString(),
        updatedAt: new Date(row.updated_at * 1000).toISOString(),
    };
}

// === CRUD ===

/**
 * Get all library templates for a user.
 */
export function getLibraryLinks(userId: string): LinkLibraryEntry[] {
    try {
        const rows = getDb().prepare(
            'SELECT * FROM link_library WHERE user_id = ? ORDER BY created_at DESC'
        ).all(userId) as LinkLibraryRow[];

        return rows.map(row => rowToEntry(row));
    } catch (error) {
        logger.error(`[LinkLibrary] getLibraryLinks failed: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Get a single library template by ID and user.
 */
export function getLibraryLink(id: string, userId: string): LinkLibraryEntry | null {
    try {
        const row = getDb().prepare(
            'SELECT * FROM link_library WHERE id = ? AND user_id = ?'
        ).get(id, userId) as LinkLibraryRow | undefined;

        if (!row) return null;

        return rowToEntry(row);
    } catch (error) {
        logger.error(`[LinkLibrary] getLibraryLink failed: id=${id} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Create a new library template.
 */
export function createLibraryLink(userId: string, data: CreateLinkData): LinkLibraryEntry {
    try {
        const id = uuidv4();

        getDb().prepare(`
            INSERT INTO link_library (id, user_id, title, icon, size, type, url, style, action)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            userId,
            data.title,
            data.icon || 'Link',
            data.size || 'circle',
            data.type || 'link',
            data.url || '',
            JSON.stringify(data.style || {}),
            data.action ? JSON.stringify(data.action) : null
        );

        logger.info(`[LinkLibrary] Created: id=${id} user=${userId} title="${data.title}"`);

        const created = getDb().prepare(
            'SELECT * FROM link_library WHERE id = ?'
        ).get(id) as LinkLibraryRow;

        return rowToEntry(created);
    } catch (error) {
        logger.error(`[LinkLibrary] createLibraryLink failed: user=${userId} error="${(error as Error).message}"`);
        throw error;
    }
}

/**
 * Delete a library template.
 */
export function deleteLibraryLink(id: string, userId: string): boolean {
    try {
        const result = getDb().prepare(
            'DELETE FROM link_library WHERE id = ? AND user_id = ?'
        ).run(id, userId);

        if (result.changes === 0) return false;

        logger.info(`[LinkLibrary] Deleted: id=${id}`);
        return true;
    } catch (error) {
        logger.error(`[LinkLibrary] deleteLibraryLink failed: id=${id} error="${(error as Error).message}"`);
        throw error;
    }
}

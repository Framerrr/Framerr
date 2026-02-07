/**
 * Settings Invalidation Broadcast Utility
 *
 * Unified system for real-time settings propagation across all connected sessions.
 * Call this from any backend route after saving user settings.
 *
 * Phase 1: Replaces custom per-entity SSE events (e.g., permissions:widgets)
 * with a single generic invalidation pattern.
 *
 * Usage:
 *   import { invalidateUserSettings, invalidateSystemSettings } from '../utils/invalidateUserSettings';
 *
 *   // After saving user-specific settings:
 *   invalidateUserSettings(userId, 'permissions');
 *   invalidateUserSettings(userId, 'groups');
 *
 *   // After saving system-wide settings (affects all users):
 *   invalidateSystemSettings('app-config');  // server name, icon, etc.
 *
 * For instance-level invalidation (optional future use):
 *   invalidateUserSettings(userId, 'integration:abc123');
 */

import { broadcastToUser, broadcastToAllUsers } from '../services/sseStreamService';
import logger from './logger';

/**
 * Broadcast that a user-specific settings entity has changed.
 * Frontend will receive this and invalidate the corresponding React Query cache.
 *
 * @param userId - Target user ID (the user whose cache should be invalidated)
 * @param entity - Entity key (e.g., 'permissions', 'groups', 'tabs', 'templates')
 *                 For instance-level: use 'entity:id' format (e.g., 'integration:abc123')
 */
export function invalidateUserSettings(userId: string, entity: string): void {
    logger.debug(`[SettingsInvalidation] Broadcasting to user: userId=${userId} entity=${entity}`);
    broadcastToUser(userId, 'settings:invalidate', { entity });
}

/**
 * Broadcast that a system-wide settings entity has changed.
 * All connected users receive this and invalidate their React Query cache.
 *
 * @param entity - Entity key (e.g., 'app-config', 'auth-config')
 */
export function invalidateSystemSettings(entity: string): void {
    logger.debug(`[SettingsInvalidation] Broadcasting to all users: entity=${entity}`);
    broadcastToAllUsers('settings:invalidate', { entity });
}

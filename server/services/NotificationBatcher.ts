/**
 * NotificationBatcher
 * 
 * Batches service status notifications within a configurable time window.
 * This prevents notification spam when multiple monitors change status simultaneously.
 * 
 * Used by: ServicePoller
 */

import { createNotification } from '../db/notifications';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface PendingNotification {
    monitorName: string;
    integrationName: string; // Integration display name for consistent titling
    instanceId: string;       // Instance ID for per-instance batching
    iconId: string | null;
    lucideIcon: string | null;  // Lucide icon name (e.g., "Server")
    status: 'up' | 'down' | 'degraded';
    errorMessage: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const BATCH_WINDOW_MS = 10000; // 10 seconds

// ============================================================================
// NotificationBatcher Class
// ============================================================================

class NotificationBatcher {
    // Map key = "${userId}-${instanceId}-${status}" (e.g., "user123-instance456-down")
    private pending: Map<string, PendingNotification[]> = new Map();
    private timers: Map<string, NodeJS.Timeout> = new Map();

    /**
     * Add a notification to the batch. Starts a 10-second timer if first in batch.
     */
    add(
        userId: string,
        instanceId: string,
        status: 'up' | 'down' | 'degraded',
        monitorName: string,
        iconId: string | null,
        lucideIcon: string | null = null,
        integrationName: string = ''
    ): void {
        const key = `${userId}-${instanceId}-${status}`;

        // Add to pending
        if (!this.pending.has(key)) {
            this.pending.set(key, []);
        }

        this.pending.get(key)!.push({
            monitorName,
            integrationName,
            instanceId,
            iconId,
            lucideIcon,
            status,
            errorMessage: null,
        });

        logger.debug(`[Batcher] Notification added: key=${key} monitor=${monitorName} pending=${this.pending.get(key)!.length}`);

        // Start timer if this is the first item
        if (!this.timers.has(key)) {
            logger.debug(`[Batcher] Starting batch timer: key=${key} windowMs=${BATCH_WINDOW_MS}`);
            const timer = setTimeout(() => {
                this.flush(userId, instanceId, status);
            }, BATCH_WINDOW_MS);
            this.timers.set(key, timer);
        }
    }

    /**
     * Flush and send the batched notification.
     */
    private async flush(userId: string, instanceId: string, status: 'up' | 'down' | 'degraded'): Promise<void> {
        const key = `${userId}-${instanceId}-${status}`;
        const items = this.pending.get(key) || [];

        // Clear state
        this.pending.delete(key);
        const timer = this.timers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(key);
        }

        if (items.length === 0) return;

        logger.info(`[Batcher] Flushing notification batch: key=${key} count=${items.length}`);

        // Build notification content
        const count = items.length;
        const names = items.map(i => i.monitorName);
        const iconIds = items.map(i => i.iconId).filter((id): id is string => id !== null);
        const lucideIcons = items.map(i => i.lucideIcon).filter((name): name is string => name !== null);

        // Generate title
        // Format: "{Integration}: {MonitorName} is UP/DOWN/DEGRADED" or "{Integration}: N Services Down"
        const instanceName = items[0]?.integrationName || '';
        const statusText = status === 'up' ? 'Recovered' : status === 'down' ? 'Down' : 'Degraded';
        const title = count === 1
            ? instanceName
                ? `${instanceName}: ${names[0]} is ${status.toUpperCase()}`
                : `${names[0]} is ${status.toUpperCase()}`
            : instanceName
                ? `${instanceName}: ${count} Services ${statusText}`
                : `${count} Services ${statusText}`;

        // Generate message
        let message: string;
        if (count === 1) {
            message = status === 'up' ? 'Service recovered'
                : status === 'down' ? 'Service is unreachable'
                    : 'Response time is slow';
        } else if (count <= 3) {
            message = names.join(', ') + (status === 'up' ? ' recovered' : status === 'down' ? ' are unreachable' : ' are slow');
        } else {
            message = names.slice(0, 2).join(', ') + `, and ${count - 2} more ${status === 'up' ? 'recovered' : status === 'down' ? 'are unreachable' : 'are slow'}`;
        }

        // Map status to notification type
        const notificationType = status === 'down' ? 'error'
            : status === 'up' ? 'success'
                : 'warning';

        // Determine which icons to use - Lucide icons take priority over custom iconIds
        // For single notifications: prefer lucideIcon over iconId
        // For batched: only show custom icons if no Lucide icons exist
        const useLucideIcons = lucideIcons.length > 0;

        // Create the notification
        try {
            await createNotification({
                userId,
                type: notificationType,
                title,
                message,
                // Only include iconId if NOT using Lucide icons
                iconId: !useLucideIcons && iconIds.length === 1 ? iconIds[0] : null,
                iconIds: !useLucideIcons && iconIds.length > 1 ? iconIds : undefined,
                metadata: useLucideIcons ? {
                    lucideIcon: lucideIcons.length === 1 ? lucideIcons[0] : null,
                    lucideIcons: lucideIcons.length > 1 ? lucideIcons : undefined,
                } : undefined,
            });
            logger.info(`[Batcher] Batched notification sent: userId=${userId} status=${status} count=${count} title="${title}"`);
        } catch (error) {
            logger.error(`[Batcher] Failed to send batched notification: userId=${userId} status=${status} error="${(error as Error).message}"`);
        }
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const notificationBatcher = new NotificationBatcher();

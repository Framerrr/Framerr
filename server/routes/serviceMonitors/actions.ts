/**
 * Service Monitors Actions Routes
 * 
 * Admin-only action endpoints for maintenance and notifications.
 * 
 * Endpoints:
 * - POST /:id/maintenance - Toggle maintenance mode
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import * as serviceMonitorsDb from '../../db/serviceMonitors';
import * as integrationInstancesDb from '../../db/integrationInstances';
import { createNotification } from '../../db/notifications';
import { userWantsEvent } from '../../services/webhookUserResolver';
import logger from '../../utils/logger';

const router = Router();

/**
 * POST /:id/maintenance
 * Toggle maintenance mode (admin only)
 */
router.post('/:id/maintenance', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            res.status(400).json({ error: 'enabled (boolean) is required' });
            return;
        }

        // Get monitor before update for notification
        const monitor = await serviceMonitorsDb.getMonitorById(id);
        if (!monitor) {
            res.status(404).json({ error: 'Monitor not found' });
            return;
        }

        const success = await serviceMonitorsDb.setMonitorMaintenance(id, enabled);
        if (!success) {
            res.status(404).json({ error: 'Failed to update monitor' });
            return;
        }

        // Trigger immediate SSE update using the same flow as regular polling
        // This ensures the frontend gets the updated data through the normal path
        const integrationInstanceId = monitor.integrationInstanceId;
        if (integrationInstanceId) {
            const integrationType = integrationInstanceId.split('-')[0]; // "monitor" or "uptimekuma"
            const topic = `${integrationType}:${integrationInstanceId}`;

            // Import here to avoid circular dependency
            const { triggerTopicPoll } = await import('../../services/sseStreamService');
            await triggerTopicPoll(topic);
        }

        // Get webhookConfig from monitor's integration instance (per-instance config)
        let webhookConfig: { adminEvents?: string[]; userEvents?: string[] } | undefined;
        let instanceDisplayName: string | null = null;
        if (monitor.integrationInstanceId) {
            const instance = integrationInstancesDb.getInstanceById(monitor.integrationInstanceId);
            webhookConfig = instance?.config?.webhookConfig as typeof webhookConfig;
            instanceDisplayName = instance?.displayName || null;
        }

        // Determine notification event key
        const eventKey = enabled ? 'serviceMaintenanceStart' : 'serviceMaintenanceEnd';

        // Get icon ID and lucide icon (same pattern as servicePoller)
        let notificationIconId: string | null = monitor.iconId || null;
        let notificationLucideIcon: string | null = null;

        if (monitor.iconName?.startsWith('custom:')) {
            // Custom icon - extract slug for iconId
            notificationIconId = monitor.iconName.replace('custom:', '');
        } else if (monitor.iconName) {
            // Lucide icon - pass name in metadata, clear iconId
            notificationLucideIcon = monitor.iconName;
            notificationIconId = null; // Ensure iconId doesn't take priority
        }

        // Build notification title with instance name prefix for consistency
        const titlePrefix = instanceDisplayName ? `${instanceDisplayName}: ` : '';
        const maintenanceTitle = enabled
            ? `${titlePrefix}${monitor.name} is under maintenance`
            : `${titlePrefix}${monitor.name} maintenance complete`;

        // Check if owner wants this event
        const ownerWantsEvent = await userWantsEvent(monitor.ownerId, 'servicemonitoring', eventKey, true, webhookConfig);
        if (ownerWantsEvent) {
            await createNotification({
                userId: monitor.ownerId,
                type: 'info',
                title: maintenanceTitle,
                message: '',
                iconId: notificationIconId,
                metadata: notificationLucideIcon ? { lucideIcon: notificationLucideIcon } : undefined,
            });
        }

        // Notify shared users
        const shares = await serviceMonitorsDb.getMonitorShares(id);
        for (const share of shares) {
            if (share.notify) {
                const userWants = await userWantsEvent(share.userId, 'servicemonitoring', eventKey, false, webhookConfig);
                if (userWants) {
                    await createNotification({
                        userId: share.userId,
                        type: 'info',
                        title: maintenanceTitle,
                        message: '',
                        iconId: notificationIconId,
                        metadata: notificationLucideIcon ? { lucideIcon: notificationLucideIcon } : undefined,
                    });
                }
            }
        }

        res.json({ success: true, maintenance: enabled });
    } catch (error) {
        logger.error(`[ServiceMonitors] Failed to toggle maintenance: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to toggle maintenance' });
    }
});

export default router;

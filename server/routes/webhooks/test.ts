/**
 * Webhook Test Endpoint
 * 
 * DEV/ADMIN ONLY: Test webhook user matching logic.
 * 
 * Endpoint: POST /api/webhooks/test/overseerr-match
 */
import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { createNotification } from '../../db/notifications';
import { resolveUserByUsername, getAdminsWithReceiveUnmatched } from '../../services/webhookUserResolver';
import { getSystemIconIdForService } from '../../services/systemIcons';
import logger from '../../utils/logger';
import { OVERSEERR_EVENT_MAP } from './types';

const router = Router();

/**
 * POST /test/overseerr-match
 * 
 * DEV ONLY: Simulates an Overseerr notification to test user matching logic.
 * Returns which user was matched (or if no match was found).
 * 
 * Body: { username: string, eventType?: string }
 */
router.post('/overseerr-match', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const { username, eventType = 'requestApproved' } = req.body;

    if (!username) {
        res.status(400).json({ error: 'username is required' });
        return;
    }

    logger.info(`[Webhook Test] Simulating Overseerr: user="${username}" event=${eventType}`);

    // Use the same matching logic as real Overseerr webhooks
    const eventKey = OVERSEERR_EVENT_MAP[eventType] || 'requestApproved';
    const user = await resolveUserByUsername(username, 'overseerr');

    if (user) {
        // Matched! Send a real test notification to this user
        const iconId = getSystemIconIdForService('overseerr');

        await createNotification({
            userId: user.id,
            type: 'success',
            title: '[Test] Overseerr Match',
            message: `Test notification for "${username}" → matched to you!`,
            iconId,
            metadata: { service: 'overseerr', test: true }
        });

        logger.info(`[Webhook Test] User matched: input="${username}" matched=${user.id} (${user.username})`);

        res.json({
            matched: true,
            inputUsername: username,
            matchedUser: {
                id: user.id,
                username: user.username,
                group: user.group
            },
            notificationSent: true
        });
    } else {
        // No match - report what the fallback would do
        const adminsWithUnmatched = await getAdminsWithReceiveUnmatched();

        logger.info(`[Webhook Test] No match: input="${username}" fallbackAdmins=${adminsWithUnmatched.length}`);

        res.json({
            matched: false,
            inputUsername: username,
            matchedUser: null,
            fallbackBehavior: {
                message: 'Would send to admins with "Receive Unmatched" enabled',
                adminCount: adminsWithUnmatched.length,
                admins: adminsWithUnmatched.map(a => ({ id: a.id, username: a.username }))
            }
        });
    }
});

export default router;

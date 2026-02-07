/**
 * Radarr Proxy Routes
 * 
 * Handles Radarr API proxying:
 * - /calendar - Get upcoming movies
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../../../utils/logger';
import { httpsAgent } from '../../../utils/httpsAgent';
import * as integrationInstancesDb from '../../../db/integrationInstances';
import { requireAuth } from '../../../middleware/auth';
import { userHasIntegrationAccess } from '../../../db/integrationShares';

const router = Router();

/**
 * GET /:id/proxy/calendar - Get Radarr calendar
 */
router.get('/:id/proxy/calendar', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { start, end } = req.query;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'radarr') {
        res.status(404).json({ error: 'Radarr integration not found' });
        return;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('radarr', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Radarr configuration' });
        return;
    }

    try {
        const queryParams = new URLSearchParams();
        if (start) queryParams.set('start', start as string);
        if (end) queryParams.set('end', end as string);

        const response = await axios.get(`${url}/api/v3/calendar?${queryParams}`, {
            headers: { 'X-Api-Key': apiKey },
            httpsAgent,
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Radarr Proxy] Calendar error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Radarr calendar' });
    }
});

export default router;

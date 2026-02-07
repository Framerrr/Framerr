/**
 * Sonarr Proxy Routes
 * 
 * Handles Sonarr API proxying:
 * - /calendar - Get upcoming episodes
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
 * GET /:id/proxy/calendar - Get Sonarr calendar
 */
router.get('/:id/proxy/calendar', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { start, end, includeSeries } = req.query;
    const isAdmin = req.user!.group === 'admin';

    const instance = integrationInstancesDb.getInstanceById(id);
    if (!instance || instance.type !== 'sonarr') {
        res.status(404).json({ error: 'Sonarr integration not found' });
        return;
    }

    if (!isAdmin) {
        const hasAccess = await userHasIntegrationAccess('sonarr', req.user!.id, req.user!.group);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    }

    const url = instance.config.url as string;
    const apiKey = instance.config.apiKey as string;

    if (!url || !apiKey) {
        res.status(400).json({ error: 'Invalid Sonarr configuration' });
        return;
    }

    try {
        const queryParams = new URLSearchParams();
        if (start) queryParams.set('start', start as string);
        if (end) queryParams.set('end', end as string);
        if (includeSeries) queryParams.set('includeSeries', 'true');

        const response = await axios.get(`${url}/api/v3/calendar?${queryParams}`, {
            headers: { 'X-Api-Key': apiKey },
            httpsAgent,
            timeout: 10000
        });

        res.json(response.data);
    } catch (error) {
        logger.error(`[Sonarr Proxy] Calendar error: error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to fetch Sonarr calendar' });
    }
});

export default router;

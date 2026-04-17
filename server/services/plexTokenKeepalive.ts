/**
 * Plex Token Keepalive Service
 * 
 * Periodically pings the plex.tv API to keep stored Plex tokens alive,
 * preventing WebSocket 401 disconnects caused by token expiry.
 * 
 * Follows the same pattern as Overseerr's refreshToken.ts / PlexTvAPI.pingToken():
 * - GET https://plex.tv/api/v2/ping with X-Plex-Token header
 * - Scheduled via cron (every 6 hours)
 * - Iterates all configured Plex integration instances
 * 
 * This is proactive prevention only — it will NOT recover already-expired tokens.
 */

import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger';
import { registerJob, unregisterJob } from './jobScheduler';
import { getInstancesByType } from '../db/integrationInstances';

// ============================================================================
// CONSTANTS
// ============================================================================

const PLEX_TV_API = 'https://plex.tv/api/v2';
const JOB_ID = 'plex-token-keepalive';
const CRON_SCHEDULE = '0 */6 * * *'; // Every 6 hours

// ============================================================================
// TOKEN PING
// ============================================================================

/**
 * Ping plex.tv to keep a single token alive.
 * Uses the same endpoint and headers as Overseerr's PlexTvAPI.pingToken().
 * 
 * @param token - The Plex authentication token to keep alive
 * @param instanceId - Instance ID for logging context
 * @returns true if ping succeeded, false otherwise
 */
async function pingPlexToken(token: string, instanceId: string): Promise<boolean> {
    try {
        await axios.get(`${PLEX_TV_API}/ping`, {
            headers: {
                'Accept': 'application/json',
                'X-Plex-Token': token,
                'X-Plex-Client-Identifier': crypto.randomUUID(),
            },
            timeout: 15000, // 15 second timeout
        });

        logger.info(`[PlexTokenKeepalive] Ping success for instance ${instanceId}`);
        return true;
    } catch (error) {
        const message = (error as Error).message;
        logger.warn(`[PlexTokenKeepalive] Ping failed for instance ${instanceId}: error="${message}"`);
        return false;
    }
}

// ============================================================================
// KEEPALIVE JOB
// ============================================================================

/**
 * Run the token keepalive for all enabled Plex instances.
 * Called by the job scheduler on cron schedule and on startup.
 */
async function runTokenKeepalive(): Promise<void> {
    const instances = getInstancesByType('plex');

    // Filter to enabled instances with a non-empty token
    const eligibleInstances = instances.filter(
        inst => inst.enabled && inst.config && typeof inst.config.token === 'string' && inst.config.token.length > 0
    );

    if (eligibleInstances.length === 0) {
        logger.info('[PlexTokenKeepalive] No enabled Plex instances to ping');
        return;
    }

    logger.info(`[PlexTokenKeepalive] Pinging ${eligibleInstances.length} Plex instance(s)`);

    let successCount = 0;
    let failCount = 0;

    for (const instance of eligibleInstances) {
        const success = await pingPlexToken(instance.config.token as string, instance.id);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    logger.info(`[PlexTokenKeepalive] Complete: success=${successCount} failed=${failCount}`);
}

// ============================================================================
// LIFECYCLE
// ============================================================================

/**
 * Start the Plex token keepalive service.
 * Registers a cron job that pings plex.tv every 6 hours to keep tokens alive.
 * Runs once on startup (runOnStart: true) for immediate token refresh.
 */
export function startPlexTokenKeepalive(): void {
    registerJob({
        id: JOB_ID,
        name: 'Plex Token Keepalive',
        cronExpression: CRON_SCHEDULE,
        description: 'Pings plex.tv to keep Plex tokens alive and prevent WebSocket 401 errors',
        execute: runTokenKeepalive,
        runOnStart: true,
    });

    logger.info(`[PlexTokenKeepalive] Registered job: ${JOB_ID}`);
}

/**
 * Stop the Plex token keepalive service.
 * Called during server shutdown.
 */
export function stopPlexTokenKeepalive(): void {
    unregisterJob(JOB_ID);
}

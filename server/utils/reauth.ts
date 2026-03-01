/**
 * Jellyfin/Emby Re-Authentication Helper
 * 
 * Handles automatic token refresh when session tokens expire.
 * Called by adapters on 401/403 responses.
 * 
 * Flow:
 *   1. Check if stored credentials exist (jellyfinUsername + jellyfinPassword)
 *   2. If yes → call /Users/AuthenticateByName → update config.apiKey
 *   3. If no or auth fails → set config.needsReauth = true
 */

import axios from 'axios';
import { getInstanceById, updateInstance } from '../db/integrationInstances';
import { translateHostUrl } from '../utils/urlHelper';
import { httpsAgent } from '../utils/httpsAgent';
import logger from '../utils/logger';

interface ReauthResult {
    success: boolean;
    newApiKey?: string;
    error?: string;
}

interface AuthResponse {
    AccessToken: string;
    User: {
        Id: string;
        Name: string;
    };
}

/**
 * Attempt to re-authenticate a Jellyfin or Emby integration using stored credentials.
 * On success, updates the integration's apiKey in the database.
 * On failure, marks the integration as needsReauth.
 * 
 * @param instanceId - The integration instance ID
 * @returns Result with new API key on success
 */
export async function reauthenticate(instanceId: string): Promise<ReauthResult> {
    const instance = getInstanceById(instanceId);
    if (!instance) {
        return { success: false, error: 'Integration not found' };
    }

    const username = instance.config.jellyfinUsername as string | undefined;
    const password = instance.config.jellyfinPassword as string | undefined;

    // No stored credentials — can't auto-heal
    if (!username) {
        logger.warn(`[Reauth] No stored credentials for ${instance.type}:${instanceId} — marking needsReauth`);
        markNeedsReauth(instanceId, instance.config);
        return { success: false, error: 'No stored credentials. Re-enter username and password.' };
    }

    const url = instance.config.url as string;
    if (!url) {
        return { success: false, error: 'No server URL configured' };
    }

    const baseUrl = translateHostUrl(url).replace(/\/$/, '');
    const serverType = instance.type; // 'jellyfin' or 'emby'

    try {
        logger.info(`[Reauth] Attempting re-authentication: type=${serverType} id=${instanceId}`);

        const authHeader = `MediaBrowser Client="Framerr", Device="Server", DeviceId="framerr-reauth", Version="1.0"`;

        const response = await axios.post<AuthResponse>(
            `${baseUrl}/Users/AuthenticateByName`,
            { Username: username, Pw: password || '' },
            {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                httpsAgent,
                timeout: 15000,
            }
        );

        const { AccessToken, User } = response.data;

        // Update the stored apiKey with the fresh token
        const updatedConfig = {
            ...instance.config,
            apiKey: AccessToken,
            userId: User.Id,
            needsReauth: false, // Clear the flag
        };

        updateInstance(instanceId, { config: updatedConfig });

        logger.info(`[Reauth] Success: type=${serverType} id=${instanceId} user="${User.Name}"`);
        return { success: true, newApiKey: AccessToken };

    } catch (error) {
        const axiosError = error as { response?: { status?: number }; message?: string };
        const status = axiosError.response?.status;

        if (status === 401) {
            // Password changed or account locked — user must re-enter credentials
            logger.warn(`[Reauth] Credentials rejected (401): type=${serverType} id=${instanceId} — marking needsReauth`);
            markNeedsReauth(instanceId, instance.config);
            return { success: false, error: 'Stored credentials are no longer valid. Please re-enter your password.' };
        }

        // Network error, server down, etc — don't mark needsReauth (transient)
        logger.error(`[Reauth] Failed: type=${serverType} id=${instanceId} status=${status} error="${axiosError.message}"`);
        return { success: false, error: `Re-authentication failed: ${axiosError.message}` };
    }
}

/**
 * Mark an integration as needing re-authentication.
 * Sets needsReauth=true in the config without clearing other fields.
 */
function markNeedsReauth(instanceId: string, currentConfig: Record<string, unknown>): void {
    updateInstance(instanceId, {
        config: {
            ...currentConfig,
            needsReauth: true,
        },
    });
}

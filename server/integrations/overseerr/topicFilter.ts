/**
 * Overseerr Topic Filter
 * 
 * Per-user filtering for Overseerr SSE data based on the `seeAllRequests` config toggle.
 * When enabled (default): all users see all requests (current behavior).
 * When disabled: users see only their own requests (filtered by linked Overseerr account).
 * 
 * Bypass: Framerr admins always see all requests regardless of toggle.
 * 
 * Registered as a topic filter on the PollerOrchestrator for 'overseerr:' topics.
 */

import { getLinkedAccount } from '../../db/linkedAccounts';
import * as integrationInstancesDb from '../../db/integrationInstances';
import { pollerOrchestrator, parseTopic } from '../../services/sse/PollerOrchestrator';
import { getDb } from '../../database/db';
import logger from '../../utils/logger';

// Overseerr permission bitmasks
const ADMIN = 0x2;             // Overseerr admin — implicit access to everything
const MANAGE_REQUESTS = 0x4000; // Granular permission to manage requests

/**
 * Check if Framerr user is an admin (sync, direct DB query).
 */
function isFramerrAdmin(userId: string): boolean {
    try {
        const row = getDb().prepare(
            `SELECT group_id FROM users WHERE id = ?`
        ).get(userId) as { group_id: string } | undefined;
        return row?.group_id === 'admin';
    } catch {
        return false;
    }
}

/**
 * Check if user has request management capability in their linked Overseerr account.
 * Recognizes both ADMIN (0x2) and MANAGE_REQUESTS (0x4000) permission bits.
 */
function hasManageRequestsPermission(userId: string): boolean {
    const link = getLinkedAccount(userId, 'overseerr');
    if (!link?.metadata?.permissions) return false;
    return ((link.metadata.permissions as number) & (ADMIN | MANAGE_REQUESTS)) !== 0;
}

/**
 * The Overseerr topic filter function.
 * Called per-subscriber when broadcasting Overseerr SSE data.
 * 
 * Logic:
 * 1. Extract instanceId from topic (e.g., 'overseerr:abc123' → 'abc123')
 * 2. Check instance config for seeAllRequests toggle
 * 3. If ON → return all data unchanged
 * 4. If OFF → filter based on user's linked Overseerr account
 */
function overseerrTopicFilter(userId: string, data: unknown, topic: string): unknown {
    const dataObj = data as Record<string, unknown>;

    // Extract instanceId from topic (e.g., 'overseerr:abc123')
    const { instanceId } = parseTopic(topic);
    if (!instanceId) return data; // Safety: can't filter without instance context

    // Check instance config for seeAllRequests toggle
    const instance = integrationInstancesDb.getInstanceById(instanceId);
    const rawSeeAll = instance?.config?.seeAllRequests;
    const seeAllRequests = rawSeeAll === undefined ? true : !!rawSeeAll; // undefined=true (backward compat), ''=false (checkbox off)

    if (seeAllRequests) {
        // Toggle is ON — return all data unchanged (current default behavior)
        return data;
    }

    // Framerr admin bypass — always see all requests regardless of Overseerr linking
    if (isFramerrAdmin(userId)) {
        return data;
    }

    // Toggle is OFF — apply per-user filtering
    const linkedAccount = getLinkedAccount(userId, 'overseerr');

    // User has MANAGE_REQUESTS permission — can see everything
    if (linkedAccount && hasManageRequestsPermission(userId)) {
        return {
            ...dataObj,
            _meta: {
                ...(dataObj._meta as Record<string, unknown> || {}),
                perUserFiltering: true,
                userMatched: true,
                linkedUsername: linkedAccount.externalUsername || undefined,
            }
        };
    }

    // User is linked but no MANAGE_REQUESTS — filter to only their requests
    if (linkedAccount) {
        const overseerrUserId = parseInt(linkedAccount.externalId, 10);
        const results = (dataObj.results as Array<Record<string, unknown>>) || [];

        const filteredResults = results.filter((request) => {
            const requestedBy = request.requestedBy as { id?: number } | undefined;
            return requestedBy?.id === overseerrUserId;
        });

        return {
            ...dataObj,
            results: filteredResults,
            _meta: {
                ...(dataObj._meta as Record<string, unknown> || {}),
                perUserFiltering: true,
                userMatched: true,
                linkedUsername: linkedAccount.externalUsername || undefined,
            }
        };
    }

    // User is NOT linked — return empty results with flag for frontend
    return {
        ...dataObj,
        results: [],
        _meta: {
            ...(dataObj._meta as Record<string, unknown> || {}),
            perUserFiltering: true,
            userMatched: false,
        }
    };
}

/**
 * Register the Overseerr topic filter on the PollerOrchestrator.
 * Called at server startup.
 */
export function registerOverseerrTopicFilters(): void {
    pollerOrchestrator.registerTopicFilter('overseerr:', overseerrTopicFilter);
    logger.debug('[Overseerr] Topic filter registered for per-user request filtering');
}

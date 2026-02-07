/**
 * Service Poller
 * 
 * Background service for polling service monitors.
 * Handles HTTP, TCP, and Ping checks with health monitoring and auto-restart.
 */

import * as serviceMonitorsDb from '../db/serviceMonitors';
import { broadcast } from './sseStreamService';
import { userWantsEvent } from './webhookUserResolver';
import * as integrationInstancesDb from '../db/integrationInstances';
import { notificationBatcher } from './NotificationBatcher';
import { startNetworkHealthMonitor, checkNetworkHealth, isNetworkHealthy } from './networkHealth';
import { registerJob, unregisterJob } from './jobScheduler';
import logger from '../utils/logger';
import https from 'https';
import http from 'http';
import net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface PollerState {
    timerId: NodeJS.Timeout;
    lastCheck: number;
    lastStatus: string;
    consecutiveFailures: number;
    retryCount: number;         // Counts failures - DOWN only after 3 consecutive
}

// Number of consecutive failures required before marking as DOWN
const REQUIRED_FAILURES_FOR_DOWN = 3;

interface CheckResult {
    status: 'up' | 'down' | 'degraded';
    responseTimeMs: number | null;
    statusCode: number | null;
    errorMessage: string | null;
}

/**
 * Check if the current time is within a monitor's scheduled maintenance window.
 */
export function isInMaintenanceWindow(schedule: serviceMonitorsDb.MaintenanceSchedule | null): boolean {
    if (!schedule || !schedule.enabled) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0=Sun, 6=Sat
    const currentDayOfMonth = now.getDate();

    // Parse start and end times
    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);

    // Convert to minutes since midnight for comparison
    const nowMinutes = currentHour * 60 + currentMinute;
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Check if current time is within the window
    let isInTimeRange: boolean;
    if (startMinutes <= endMinutes) {
        // Normal range (e.g., 02:00 to 04:00)
        isInTimeRange = nowMinutes >= startMinutes && nowMinutes < endMinutes;
    } else {
        // Overnight range (e.g., 23:00 to 02:00)
        isInTimeRange = nowMinutes >= startMinutes || nowMinutes < endMinutes;
    }

    if (!isInTimeRange) return false;

    // Check frequency-specific conditions
    switch (schedule.frequency) {
        case 'daily':
            return true; // Always matches if time is in range

        case 'weekly':
            // Check if current day is in the selected days
            return schedule.weeklyDays?.includes(currentDay) ?? false;

        case 'monthly':
            // Check if current day of month matches (with clamping)
            if (!schedule.monthlyDay) return false;
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const effectiveDay = Math.min(schedule.monthlyDay, lastDayOfMonth);
            return currentDayOfMonth === effectiveDay;

        default:
            return false;
    }
}


// ============================================================================
// Service Poller Class
// ============================================================================

class ServicePoller {
    private pollers: Map<string, PollerState> = new Map();
    private healthCheckTimer: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private lastHealthCheck: number = Date.now();


    // HTTPS agent for self-signed certs
    private httpsAgent = new https.Agent({ rejectUnauthorized: false });

    /**
     * Start polling all enabled monitors.
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('[Poller] Already running');
            return;
        }

        this.isRunning = true;

        try {
            // Initialize network health monitoring for gateway detection
            await startNetworkHealthMonitor();

            const monitors = await serviceMonitorsDb.getEnabledMonitors();

            // Only log if there are monitors to poll
            if (monitors.length > 0) {
                logger.info(`[Poller] Monitoring ${monitors.length} services`);
            }

            for (const monitor of monitors) {
                this.addMonitor(monitor);
            }

            // Start health check (every 30 seconds)
            this.healthCheckTimer = setInterval(() => {
                this.healthCheck();
            }, 30000);

            // Register prune jobs with cron scheduler (hourly)
            registerJob({
                id: 'monitor-history-prune',
                name: 'Monitor History Prune',
                cronExpression: '0 * * * *',
                description: 'Every hour',
                execute: async () => {
                    await serviceMonitorsDb.pruneOldHistory(2);
                    logger.debug('[Poller] Pruned old monitor history');
                },
            });
            registerJob({
                id: 'monitor-aggregate-prune',
                name: 'Monitor Aggregate Prune',
                cronExpression: '0 * * * *',
                description: 'Every hour',
                execute: async () => {
                    await serviceMonitorsDb.pruneOldAggregates(30);
                    logger.debug('[Poller] Pruned old monitor aggregates');
                },
            });

        } catch (error) {
            logger.error(`[Poller] Start failed: error="${(error as Error).message}"`);
            this.isRunning = false;
        }
    }

    /**
     * Stop all polling.
     */
    stop(): void {
        logger.info('[Poller] Stopping...');

        for (const [id, state] of this.pollers) {
            clearInterval(state.timerId);
            logger.debug(`[Poller] Stopped: monitor=${id}`);
        }
        this.pollers.clear();

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        // Unregister prune cron jobs
        unregisterJob('monitor-history-prune');
        unregisterJob('monitor-aggregate-prune');

        this.isRunning = false;
        logger.info('[Poller] Stopped');
    }

    /**
     * Add a monitor to the polling loop.
     */
    addMonitor(monitor: serviceMonitorsDb.ServiceMonitor): void {
        // Remove existing if present
        this.removeMonitor(monitor.id);

        const intervalMs = monitor.intervalSeconds * 1000;

        // Create timer
        const timerId = setInterval(() => {
            this.pollMonitor(monitor.id);
        }, intervalMs);

        this.pollers.set(monitor.id, {
            timerId,
            lastCheck: 0,
            lastStatus: 'pending',
            consecutiveFailures: 0,
            retryCount: 0,
        });

        // Perform initial check
        this.pollMonitor(monitor.id);

        logger.debug(`[Poller] Added: monitor=${monitor.name} interval=${intervalMs}ms`);
    }

    /**
     * Remove a monitor from polling.
     */
    removeMonitor(id: string): void {
        const state = this.pollers.get(id);
        if (state) {
            clearInterval(state.timerId);
            this.pollers.delete(id);
            logger.debug(`[Poller] Removed: monitor=${id}`);
        }
    }

    /**
     * Update a monitor's polling interval.
     */
    async updateMonitor(monitor: serviceMonitorsDb.ServiceMonitor): Promise<void> {
        if (monitor.enabled) {
            this.addMonitor(monitor);
        } else {
            this.removeMonitor(monitor.id);
        }
    }

    /**
     * Perform a manual test (immediate check, returns result).
     */
    async testMonitor(monitor: serviceMonitorsDb.ServiceMonitor): Promise<CheckResult> {
        return this.performCheck(monitor);
    }

    /**
     * Check if the poller is healthy.
     */
    isHealthy(): boolean {
        const now = Date.now();
        const timeSinceLastHealth = now - this.lastHealthCheck;

        // If more than 2 minutes since last health check, consider unhealthy
        return this.isRunning && timeSinceLastHealth < 120000;
    }

    /**
     * Restart the poller service.
     */
    async restart(): Promise<void> {
        logger.warn('[Poller] Restarting...');
        this.stop();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.start();
    }

    /**
     * Get poller status for debugging.
     */
    getStatus(): { running: boolean; monitorCount: number; lastHealthCheck: string } {
        return {
            running: this.isRunning,
            monitorCount: this.pollers.size,
            lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
        };
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Perform a poll for a specific monitor.
     * 
     * Implements retry mechanism: service is only marked DOWN after 3 consecutive failures.
     * Also checks gateway health - if gateway is unreachable, failures are suppressed
     * (Framerr network issue, not service issue).
     */
    private async pollMonitor(monitorId: string): Promise<void> {
        try {
            const monitor = await serviceMonitorsDb.getMonitorById(monitorId);
            if (!monitor) {
                this.removeMonitor(monitorId);
                return;
            }

            if (!monitor.enabled) {
                this.removeMonitor(monitorId);
                return;
            }

            const result = await this.performCheck(monitor);
            const state = this.pollers.get(monitorId);

            if (!state) return;

            // Record to history (always record raw result)
            await serviceMonitorsDb.recordCheck(monitorId, result);

            // Consider scheduled maintenance window as well as manual maintenance
            const inScheduledMaintenance = isInMaintenanceWindow(monitor.maintenanceSchedule);
            const isInMaintenance = monitor.maintenance || inScheduledMaintenance;

            // Track maintenance period in aggregates for grey tick bars
            if (isInMaintenance) {
                await serviceMonitorsDb.updateMaintenanceAggregate(monitorId);
            }

            state.lastCheck = Date.now();

            // ================================================================
            // RETRY LOGIC WITH GATEWAY HEALTH CHECK
            // ================================================================

            const oldStatus = state.lastStatus;

            if (result.status === 'down' || result.status === 'degraded') {
                // Check failure - increment retry count

                // First, check if this is a Framerr network issue (gateway unreachable)
                await checkNetworkHealth();
                const networkOk = isNetworkHealthy();

                if (!networkOk) {
                    // Gateway unreachable - Framerr has network issue
                    // Don't count this failure against the service
                    logger.debug(`[Poller] Gateway unreachable: monitor=${monitor.name} retryCount=${state.retryCount}`);
                    // Don't update lastStatus or retryCount - pretend this check didn't happen
                    return;
                }

                // Network is OK, service check failed - count it
                state.retryCount++;
                state.consecutiveFailures++;

                logger.debug(`[Poller] Check failed: monitor=${monitor.name} result=${result.status} retry=${state.retryCount}/${REQUIRED_FAILURES_FOR_DOWN}`);

                if (state.retryCount >= REQUIRED_FAILURES_FOR_DOWN) {
                    // Confirmed failure - mark as DOWN
                    const newStatus = isInMaintenance ? 'maintenance' : result.status;
                    state.lastStatus = newStatus;

                    if (oldStatus !== 'pending' && oldStatus !== newStatus) {
                        // Status changed to down/degraded - notify
                        this.handleStatusChange(monitor, oldStatus, newStatus, result);
                    }
                } else {
                    // Still in retry phase - don't change status yet
                    logger.debug(`[Poller] ${monitor.name}: retry ${state.retryCount}/${REQUIRED_FAILURES_FOR_DOWN}`);
                }

            } else {
                // Check succeeded - service is UP

                // If we were in retry phase (some failures but not confirmed down),
                // just reset without notification
                if (state.retryCount > 0 && state.lastStatus !== 'down' && state.lastStatus !== 'degraded') {
                    logger.debug(`[Poller] ${monitor.name}: recovered during retry phase`);
                }

                // Reset retry count
                state.retryCount = 0;
                state.consecutiveFailures = 0;

                const newStatus = isInMaintenance ? 'maintenance' : 'up';

                // Only notify if previously confirmed DOWN/DEGRADED
                if (oldStatus !== 'pending' && oldStatus !== newStatus &&
                    (oldStatus === 'down' || oldStatus === 'degraded')) {
                    // Recovered from confirmed down state
                    this.handleStatusChange(monitor, oldStatus, newStatus, result);
                }

                state.lastStatus = newStatus;
            }

        } catch (error) {
            logger.error(`[Poller] Poll failed: monitor=${monitorId} error="${(error as Error).message}"`);
        }
    }

    /**
     * Perform the actual check based on monitor type.
     */
    private async performCheck(monitor: serviceMonitorsDb.ServiceMonitor): Promise<CheckResult> {
        const startTime = Date.now();

        try {
            switch (monitor.type) {
                case 'http':
                    return await this.checkHttp(monitor, startTime);
                case 'tcp':
                    return await this.checkTcp(monitor, startTime);
                case 'ping':
                    return await this.checkPing(monitor, startTime);
                default:
                    return { status: 'down', responseTimeMs: null, statusCode: null, errorMessage: `Unknown type: ${monitor.type}` };
            }
        } catch (error) {
            const elapsed = Date.now() - startTime;
            return {
                status: 'down',
                responseTimeMs: elapsed,
                statusCode: null,
                errorMessage: (error as Error).message,
            };
        }
    }

    /**
     * HTTP check with redirect following.
     */
    private async checkHttp(monitor: serviceMonitorsDb.ServiceMonitor, startTime: number): Promise<CheckResult> {
        if (!monitor.url) {
            return { status: 'down', responseTimeMs: null, statusCode: null, errorMessage: 'No URL configured' };
        }

        const maxRedirects = 10;
        let redirectCount = 0;
        let currentUrl = monitor.url;

        const doRequest = (urlString: string): Promise<CheckResult> => {
            return new Promise((resolve) => {
                const timeoutMs = monitor.timeoutSeconds * 1000;
                let url: URL;

                try {
                    url = new URL(urlString);
                } catch {
                    resolve({ status: 'down', responseTimeMs: null, statusCode: null, errorMessage: 'Invalid URL' });
                    return;
                }

                const isHttps = url.protocol === 'https:';
                const lib = isHttps ? https : http;

                const options: https.RequestOptions = {
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    method: 'GET',
                    timeout: timeoutMs,
                    agent: isHttps ? this.httpsAgent : undefined,
                };

                const req = lib.request(options, (res) => {
                    const elapsed = Date.now() - startTime;
                    const statusCode = res.statusCode || 0;

                    // Handle redirects (3xx status codes with Location header)
                    if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
                        redirectCount++;
                        if (redirectCount > maxRedirects) {
                            resolve({
                                status: 'down',
                                responseTimeMs: elapsed,
                                statusCode,
                                errorMessage: `Too many redirects (>${maxRedirects})`,
                            });
                            return;
                        }

                        // Resolve relative URLs against current URL
                        let nextUrl: string;
                        try {
                            nextUrl = new URL(res.headers.location, urlString).href;
                        } catch {
                            resolve({
                                status: 'down',
                                responseTimeMs: elapsed,
                                statusCode,
                                errorMessage: `Invalid redirect location: ${res.headers.location}`,
                            });
                            return;
                        }

                        // Follow redirect
                        doRequest(nextUrl).then(resolve).catch(() => {
                            resolve({
                                status: 'down',
                                responseTimeMs: Date.now() - startTime,
                                statusCode: null,
                                errorMessage: 'Redirect failed',
                            });
                        });
                        return;
                    }

                    // Check if status code matches expected
                    const isValidStatus = this.isStatusCodeValid(statusCode, monitor.expectedStatusCodes);

                    if (!isValidStatus) {
                        resolve({
                            status: 'down',
                            responseTimeMs: elapsed,
                            statusCode,
                            errorMessage: `Unexpected status code: ${statusCode}`,
                        });
                        return;
                    }

                    // Check for degraded (response time > threshold)
                    const isDegraded = elapsed > monitor.degradedThresholdMs;
                    if (isDegraded) {
                        // Check rolling average for confirmed degraded status
                        this.checkDegradedStatus(monitor.id, monitor.degradedThresholdMs).then((confirmedDegraded) => {
                            resolve({
                                status: confirmedDegraded ? 'degraded' : 'up',
                                responseTimeMs: elapsed,
                                statusCode,
                                errorMessage: null,
                            });
                        });
                        return;
                    }

                    resolve({
                        status: 'up',
                        responseTimeMs: elapsed,
                        statusCode,
                        errorMessage: null,
                    });
                });

                req.on('error', (error) => {
                    const elapsed = Date.now() - startTime;
                    resolve({
                        status: 'down',
                        responseTimeMs: elapsed,
                        statusCode: null,
                        errorMessage: error.message,
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        status: 'down',
                        responseTimeMs: timeoutMs,
                        statusCode: null,
                        errorMessage: 'Request timed out',
                    });
                });

                req.end();
            });
        };

        return doRequest(currentUrl);
    }

    /**
     * TCP check.
     */
    private async checkTcp(monitor: serviceMonitorsDb.ServiceMonitor, startTime: number): Promise<CheckResult> {
        const host = monitor.url || '';
        const port = monitor.port || 80;
        const timeoutMs = monitor.timeoutSeconds * 1000;

        return new Promise((resolve) => {
            const socket = new net.Socket();

            socket.setTimeout(timeoutMs);

            socket.connect(port, host, () => {
                const elapsed = Date.now() - startTime;
                socket.destroy();

                // Check for degraded
                const isDegraded = elapsed > monitor.degradedThresholdMs;
                if (isDegraded) {
                    this.checkDegradedStatus(monitor.id, monitor.degradedThresholdMs).then((confirmedDegraded) => {
                        resolve({
                            status: confirmedDegraded ? 'degraded' : 'up',
                            responseTimeMs: elapsed,
                            statusCode: null,
                            errorMessage: null,
                        });
                    });
                    return;
                }

                resolve({
                    status: 'up',
                    responseTimeMs: elapsed,
                    statusCode: null,
                    errorMessage: null,
                });
            });

            socket.on('error', (error) => {
                const elapsed = Date.now() - startTime;
                socket.destroy();
                resolve({
                    status: 'down',
                    responseTimeMs: elapsed,
                    statusCode: null,
                    errorMessage: error.message,
                });
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve({
                    status: 'down',
                    responseTimeMs: timeoutMs,
                    statusCode: null,
                    errorMessage: 'Connection timed out',
                });
            });
        });
    }

    /**
     * Ping check (ICMP).
     */
    private async checkPing(monitor: serviceMonitorsDb.ServiceMonitor, startTime: number): Promise<CheckResult> {
        const host = monitor.url || '';
        const timeoutSeconds = monitor.timeoutSeconds;

        try {
            // Cross-platform ping command
            const isWindows = process.platform === 'win32';
            const cmd = isWindows
                ? `ping -n 1 -w ${timeoutSeconds * 1000} ${host}`
                : `ping -c 1 -W ${timeoutSeconds} ${host}`;

            await execAsync(cmd);
            const elapsed = Date.now() - startTime;

            // Check for degraded
            const isDegraded = elapsed > monitor.degradedThresholdMs;
            const confirmedDegraded = isDegraded ? await this.checkDegradedStatus(monitor.id, monitor.degradedThresholdMs) : false;

            return {
                status: confirmedDegraded ? 'degraded' : 'up',
                responseTimeMs: elapsed,
                statusCode: null,
                errorMessage: null,
            };
        } catch (error) {
            const elapsed = Date.now() - startTime;
            return {
                status: 'down',
                responseTimeMs: elapsed,
                statusCode: null,
                errorMessage: 'Ping failed',
            };
        }
    }

    /**
     * Check if status code is valid against expected codes.
     */
    private isStatusCodeValid(statusCode: number, expectedCodes: string[]): boolean {
        for (const pattern of expectedCodes) {
            if (pattern.includes('-')) {
                const [start, end] = pattern.split('-').map(Number);
                if (statusCode >= start && statusCode <= end) return true;
            } else {
                if (statusCode === Number(pattern)) return true;
            }
        }
        return false;
    }

    /**
     * Check rolling average for degraded status.
     * Returns true if 60% of last 5 checks exceed threshold.
     */
    private async checkDegradedStatus(monitorId: string, thresholdMs: number): Promise<boolean> {
        const recentChecks = await serviceMonitorsDb.getRecentChecks(monitorId, 5);
        if (recentChecks.length < 3) return false; // Not enough data

        let slowCount = 0;
        for (const check of recentChecks) {
            if (check.responseTimeMs !== null && check.responseTimeMs > thresholdMs) {
                slowCount++;
            }
        }

        return (slowCount / recentChecks.length) >= 0.6;
    }

    /**
     * Handle status change - emit SSE and optionally notify.
     */
    private async handleStatusChange(
        monitor: serviceMonitorsDb.ServiceMonitor,
        oldStatus: string,
        newStatus: string,
        result: CheckResult
    ): Promise<void> {
        logger.info(`[Poller] ${monitor.name}: ${oldStatus} → ${newStatus}`);

        // Emit SSE event
        broadcast('service-status', {
            event: 'status-change',
            monitorId: monitor.id,
            oldStatus,
            newStatus,
            errorMessage: result.errorMessage,
            responseTimeMs: result.responseTimeMs,
            timestamp: Date.now(),
        });

        // Skip notifications if in maintenance mode (manual or scheduled)
        const inScheduledMaintenance = isInMaintenanceWindow(monitor.maintenanceSchedule);
        if (monitor.maintenance || inScheduledMaintenance) return;

        // Map status to event key
        let eventKey: string | null = null;
        if (newStatus === 'down') {
            eventKey = 'serviceDown';
        } else if (newStatus === 'up' && oldStatus === 'down') {
            eventKey = 'serviceUp';
        } else if (newStatus === 'degraded') {
            eventKey = 'serviceDegraded';
        }

        if (!eventKey) return;

        // Get webhookConfig from monitor's integration instance (per-instance config)
        // If monitor has no integrationInstanceId, webhookConfig will be undefined and no notifications sent
        let webhookConfig: { adminEvents?: string[]; userEvents?: string[] } | undefined;
        let instanceDisplayName: string | null = null;
        if (monitor.integrationInstanceId) {
            const instance = integrationInstancesDb.getInstanceById(monitor.integrationInstanceId);
            webhookConfig = instance?.config?.webhookConfig as typeof webhookConfig;
            instanceDisplayName = instance?.displayName || null;
        }

        // Get icon: custom icons have 'custom:' prefix, otherwise it's a Lucide icon name
        let notificationIconId: string | null = null;
        let notificationLucideIcon: string | null = null;

        if (monitor.iconName?.startsWith('custom:')) {
            notificationIconId = monitor.iconName.replace('custom:', '');
        } else if (monitor.iconName) {
            // It's a Lucide icon name (e.g., "Server", "Globe")
            notificationLucideIcon = monitor.iconName;
        }

        logger.debug(`[Poller] Processing notification: monitor=${monitor.name} status=${newStatus} event=${eventKey} iconId=${notificationIconId} lucideIcon=${notificationLucideIcon}`);

        // Check if owner (always admin) wants this event
        const ownerWantsEvent = await userWantsEvent(monitor.ownerId, 'servicemonitoring', eventKey, true, webhookConfig);
        if (ownerWantsEvent) {
            notificationBatcher.add(
                monitor.ownerId,
                monitor.integrationInstanceId || '',
                newStatus as 'up' | 'down' | 'degraded',
                monitor.name,
                notificationIconId,
                notificationLucideIcon,
                instanceDisplayName || ''
            );
        }

        // Check shared users who opted in
        const shares = await serviceMonitorsDb.getMonitorShares(monitor.id);
        for (const share of shares) {
            if (share.notify) {
                // Check if user wants this specific event
                const userWants = await userWantsEvent(share.userId, 'servicemonitoring', eventKey, false, webhookConfig);
                if (userWants) {
                    notificationBatcher.add(
                        share.userId,
                        monitor.integrationInstanceId || '',
                        newStatus as 'up' | 'down' | 'degraded',
                        monitor.name,
                        notificationIconId,
                        notificationLucideIcon,
                        instanceDisplayName || ''
                    );
                }
            }
        }
    }

    /**
     * Health check - update last health time.
     */
    private healthCheck(): void {
        this.lastHealthCheck = Date.now();

        // Check if any pollers are stuck
        const now = Date.now();
        for (const [id, state] of this.pollers) {
            // If a monitor hasn't been checked in 5x its interval, it might be stuck
            const monitor = this.pollers.get(id);
            if (monitor && state.lastCheck > 0) {
                const timeSinceCheck = now - state.lastCheck;
                // Just log for now, don't restart individual monitors
                if (timeSinceCheck > 5 * 60 * 1000) { // 5 minutes
                    logger.warn(`[Poller] Monitor may be stuck: id=${id} timeSinceCheck=${timeSinceCheck}ms`);
                }
            }
        }
    }

    /**
     * Prune old history and aggregates data.
     */
    private async pruneOldData(): Promise<void> {
        try {
            await serviceMonitorsDb.pruneOldHistory(2);
            await serviceMonitorsDb.pruneOldAggregates(30);
        } catch (error) {
            logger.error(`[Poller] Prune failed: error="${(error as Error).message}"`);
        }
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

const servicePoller = new ServicePoller();

export default servicePoller;

/**
 * Job Scheduler Service
 * 
 * Central registry for all cron-based background jobs.
 * Uses node-cron for wall-clock reliable scheduling.
 * 
 * Jobs register here at startup and can be queried/triggered via API.
 */

import cron, { ScheduledTask } from 'node-cron';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface JobConfig {
    /** Unique job identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** Cron expression (e.g. '0 * * * *' for hourly) */
    cronExpression: string;
    /** Human-readable schedule description */
    description: string;
    /** The function to execute */
    execute: () => Promise<void> | void;
    /** Whether to run immediately on registration */
    runOnStart?: boolean;
}

export interface JobStatus {
    id: string;
    name: string;
    cronExpression: string;
    description: string;
    status: 'idle' | 'running';
    lastRun: string | null;
    nextRun: string | null;
}

interface RegisteredJob {
    config: JobConfig;
    task: ScheduledTask;
    status: 'idle' | 'running';
    lastRun: Date | null;
}

// ============================================================================
// State
// ============================================================================

const jobs = new Map<string, RegisteredJob>();

// ============================================================================
// Cron Helpers
// ============================================================================

/**
 * Calculate the next execution time from a cron expression.
 * node-cron doesn't expose this natively, so we compute it manually.
 */
function getNextCronExecution(cronExpression: string): Date | null {
    try {
        // Parse cron fields: minute hour dayOfMonth month dayOfWeek
        const parts = cronExpression.trim().split(/\s+/);
        if (parts.length < 5) return null;

        const [minuteField, hourField] = parts;
        const now = new Date();

        // Handle simple cases: fixed minute/hour patterns
        if (/^\d+$/.test(minuteField) && /^\d+$/.test(hourField)) {
            // Fixed time like "0 3 * * *" = 3:00 AM daily
            const targetMinute = parseInt(minuteField);
            const targetHour = parseInt(hourField);
            const next = new Date(now);
            next.setHours(targetHour, targetMinute, 0, 0);
            if (next <= now) {
                next.setDate(next.getDate() + 1);
            }
            return next;
        }

        if (/^\d+$/.test(minuteField) && hourField === '*') {
            // Every hour at fixed minute like "0 * * * *"
            const targetMinute = parseInt(minuteField);
            const next = new Date(now);
            next.setMinutes(targetMinute, 0, 0);
            if (next <= now) {
                next.setHours(next.getHours() + 1);
            }
            return next;
        }

        if (minuteField.startsWith('*/')) {
            // Every N minutes like "*/30 * * * *"
            const interval = parseInt(minuteField.slice(2));
            const next = new Date(now);
            const currentMinute = next.getMinutes();
            const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;
            if (nextMinute >= 60) {
                next.setHours(next.getHours() + 1);
                next.setMinutes(nextMinute - 60, 0, 0);
            } else {
                next.setMinutes(nextMinute, 0, 0);
            }
            return next;
        }

        if (/^\d+$/.test(minuteField) && hourField.startsWith('*/')) {
            // Every N hours at fixed minute like "0 */6 * * *"
            const targetMinute = parseInt(minuteField);
            const hourInterval = parseInt(hourField.slice(2));
            const next = new Date(now);
            const currentHour = next.getHours();
            // Find next hour that's a multiple of the interval
            let nextHour = Math.ceil((currentHour * 60 + next.getMinutes() + 1) / (hourInterval * 60)) * hourInterval;
            if (nextHour >= 24) {
                next.setDate(next.getDate() + 1);
                nextHour = 0;
            }
            next.setHours(nextHour, targetMinute, 0, 0);
            // If we landed on current time or past, advance by one interval
            if (next <= now) {
                next.setHours(next.getHours() + hourInterval);
                if (next.getHours() >= 24) {
                    next.setDate(next.getDate() + 1);
                    next.setHours(next.getHours() - 24);
                }
            }
            return next;
        }

        // For complex expressions, estimate ~1 hour from now
        const fallback = new Date(now.getTime() + 60 * 60 * 1000);
        return fallback;
    } catch {
        return null;
    }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Register a job with the scheduler.
 * If a job with the same ID exists, it will be replaced.
 */
export function registerJob(config: JobConfig): void {
    // Unregister existing job with same ID
    if (jobs.has(config.id)) {
        unregisterJob(config.id);
    }

    // Validate cron expression
    if (!cron.validate(config.cronExpression)) {
        logger.error(`[JobScheduler] Invalid cron expression for job ${config.id}: "${config.cronExpression}"`);
        return;
    }

    // Create the cron task
    const task = cron.schedule(config.cronExpression, async () => {
        const job = jobs.get(config.id);
        if (!job || job.status === 'running') {
            logger.debug(`[JobScheduler] Skipping ${config.id} (already running or removed)`);
            return;
        }

        job.status = 'running';
        logger.info(`[JobScheduler] Executing job: ${config.id}`);

        try {
            await config.execute();
            job.lastRun = new Date();
            logger.info(`[JobScheduler] Completed job: ${config.id}`);
        } catch (error) {
            logger.error(`[JobScheduler] Job failed: ${config.id}, error="${(error as Error).message}"`);
        } finally {
            job.status = 'idle';
        }
    });

    const registeredJob: RegisteredJob = {
        config,
        task,
        status: 'idle',
        lastRun: null,
    };

    jobs.set(config.id, registeredJob);
    logger.info(`[JobScheduler] Registered job: ${config.id} (${config.description})`);

    // Optionally run on start (with delay to not block startup)
    if (config.runOnStart) {
        setTimeout(async () => {
            const job = jobs.get(config.id);
            if (!job || job.status === 'running') return;
            job.status = 'running';
            try {
                await job.config.execute();
                job.lastRun = new Date();
                logger.debug(`[JobScheduler] Run-on-start completed: ${config.id}`);
            } catch (error) {
                logger.error(`[JobScheduler] Run-on-start failed: ${config.id}, error="${(error as Error).message}"`);
            } finally {
                job.status = 'idle';
            }
        }, 5000);
    }
}

/**
 * Unregister and stop a job.
 */
export function unregisterJob(id: string): void {
    const job = jobs.get(id);
    if (job) {
        job.task.stop();
        jobs.delete(id);
        logger.info(`[JobScheduler] Unregistered job: ${id}`);
    }
}

/**
 * Manually trigger a job to run now.
 */
export async function triggerJob(id: string): Promise<boolean> {
    const job = jobs.get(id);
    if (!job) {
        logger.warn(`[JobScheduler] Cannot trigger unknown job: ${id}`);
        return false;
    }

    if (job.status === 'running') {
        logger.warn(`[JobScheduler] Job already running: ${id}`);
        return false;
    }

    job.status = 'running';
    logger.info(`[JobScheduler] Manually triggering job: ${id}`);

    try {
        await job.config.execute();
        job.lastRun = new Date();
        logger.info(`[JobScheduler] Manual trigger completed: ${id}`);
        return true;
    } catch (error) {
        logger.error(`[JobScheduler] Manual trigger failed: ${id}, error="${(error as Error).message}"`);
        return false;
    } finally {
        job.status = 'idle';
    }
}

/**
 * Trigger a job to run in the background (fire-and-forget).
 * Returns immediately after setting status to 'running'.
 * Used for long-running jobs like library-sync where the API should respond instantly.
 */
export function triggerJobAsync(id: string): boolean {
    const job = jobs.get(id);
    if (!job) {
        logger.warn(`[JobScheduler] Cannot trigger unknown job: ${id}`);
        return false;
    }

    if (job.status === 'running') {
        logger.warn(`[JobScheduler] Job already running: ${id}`);
        return false;
    }

    job.status = 'running';
    logger.info(`[JobScheduler] Manually triggering job (async): ${id}`);

    // Fire-and-forget: execute in background, reset status when done
    Promise.resolve()
        .then(() => job.config.execute())
        .then(() => {
            job.lastRun = new Date();
            logger.info(`[JobScheduler] Async trigger completed: ${id}`);
        })
        .catch((error) => {
            logger.error(`[JobScheduler] Async trigger failed: ${id}, error="${(error as Error).message}"`);
        })
        .finally(() => {
            job.status = 'idle';
        });

    return true;
}

/**
 * Get status of all registered jobs.
 */
export function getJobStatuses(): JobStatus[] {
    const statuses: JobStatus[] = [];

    for (const [, job] of jobs) {
        const nextRun = getNextCronExecution(job.config.cronExpression);

        statuses.push({
            id: job.config.id,
            name: job.config.name,
            cronExpression: job.config.cronExpression,
            description: job.config.description,
            status: job.status,
            lastRun: job.lastRun?.toISOString() || null,
            nextRun: nextRun?.toISOString() || null,
        });
    }

    return statuses;
}

/**
 * Get status of a single job.
 */
export function getJobStatus(id: string): JobStatus | null {
    const job = jobs.get(id);
    if (!job) return null;

    const nextRun = getNextCronExecution(job.config.cronExpression);

    return {
        id: job.config.id,
        name: job.config.name,
        cronExpression: job.config.cronExpression,
        description: job.config.description,
        status: job.status,
        lastRun: job.lastRun?.toISOString() || null,
        nextRun: nextRun?.toISOString() || null,
    };
}

/**
 * Stop all registered jobs. Called on server shutdown.
 */
export function shutdownAllJobs(): void {
    logger.info(`[JobScheduler] Shutting down ${jobs.size} jobs...`);
    for (const [id] of jobs) {
        unregisterJob(id);
    }
}

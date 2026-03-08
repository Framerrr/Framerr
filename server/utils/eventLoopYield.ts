/**
 * Event Loop Yield Utility
 *
 * Provides a simple yield point for use between heavy synchronous operations
 * in cron job handlers and startup sequences. This prevents node-cron heartbeat
 * timer starvation caused by chained synchronous DB/FS calls.
 *
 * Uses setImmediate to allow pending macrotask queue items (timers, I/O callbacks)
 * to execute before continuing.
 *
 * @module server/utils/eventLoopYield
 */

/**
 * Yield to the event loop between heavy synchronous operations.
 * Uses setImmediate to allow pending I/O callbacks and timers to execute.
 */
export function yieldToEventLoop(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
}

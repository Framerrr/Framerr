/**
 * Semaphore
 * 
 * A simple counting semaphore for limiting concurrent operations.
 * Used to prevent network saturation during bulk operations like
 * library image sync.
 * 
 * @example
 * const semaphore = new Semaphore(5); // Max 5 concurrent
 * 
 * async function download(url: string) {
 *     await semaphore.acquire();
 *     try {
 *         // ... do work
 *     } finally {
 *         semaphore.release();
 *     }
 * }
 */
export class Semaphore {
    private permits: number;
    private waiting: (() => void)[] = [];

    /**
     * Create a semaphore with the given number of permits
     * @param permits Maximum concurrent operations allowed
     */
    constructor(permits: number) {
        if (permits < 1) {
            throw new Error('Semaphore permits must be at least 1');
        }
        this.permits = permits;
    }

    /**
     * Acquire a permit, waiting if none are available
     * @returns Promise that resolves when a permit is acquired
     */
    async acquire(): Promise<void> {
        if (this.permits > 0) {
            this.permits--;
            return;
        }
        // No permits available - wait in queue
        await new Promise<void>(resolve => {
            this.waiting.push(resolve);
        });
    }

    /**
     * Release a permit, allowing a waiting operation to proceed
     */
    release(): void {
        const next = this.waiting.shift();
        if (next) {
            // Give permit to next waiter
            next();
        } else {
            // No waiters - return permit to pool
            this.permits++;
        }
    }

    /**
     * Get current number of available permits
     */
    get available(): number {
        return this.permits;
    }

    /**
     * Get current number of waiting operations
     */
    get queueLength(): number {
        return this.waiting.length;
    }
}

/**
 * Log Buffer for Advanced Settings
 * 
 * Stores recent log entries in memory for display in Debug UI
 */

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    [key: string]: unknown;
}

interface LogMeta {
    [key: string]: unknown;
}

class LogBuffer {
    private logs: LogEntry[];
    private maxSize: number;

    constructor(maxSize: number = 500) {
        this.logs = [];
        this.maxSize = maxSize;
    }

    add(level: string, message: string, meta: LogMeta = {}): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message,
            ...meta
        };

        this.logs.push(entry);

        // Keep only last maxSize logs
        if (this.logs.length > this.maxSize) {
            this.logs.shift();
        }
    }

    get(): LogEntry[] {
        return [...this.logs];
    }

    clear(): void {
        this.logs = [];
    }

    toText(): string {
        return this.logs
            .map(log => `${log.timestamp} [${log.level}] ${log.message}`)
            .join('\n');
    }
}

// Export singleton
export default new LogBuffer();

/**
 * Professional Logging Utility
 * 
 * Provides environment-aware logging with multiple severity levels.
 * 
 * - Production: Clean, minimal output (startup info, errors only)
 * - Development: Verbose, structured JSON logs with metadata
 * 
 * Usage:
 *   import logger from './utils/logger';
 *   logger.info('Server started', { port: 3001 });
 *   logger.error('Database error', { error: err.message });
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogMeta {
    [key: string]: unknown;
}

interface StartupConfig {
    version?: string;
    port?: number;
    env?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

class Logger {
    level: LogLevel;
    isProduction: boolean;

    constructor() {
        // Get log level from environment, default to 'info'
        // Use import.meta.env for Vite compatibility (works in dev server and builds)
        const envLevel = import.meta.env.VITE_LOG_LEVEL || 'info';
        this.isProduction = import.meta.env.MODE === 'production';

        // Validate log level
        if (!(envLevel in LOG_LEVELS)) {
            console.warn(`Invalid LOG_LEVEL "${envLevel}", defaulting to "info"`);
            this.level = 'info';
        } else {
            this.level = envLevel as LogLevel;
        }
    }

    /**
     * Format log message based on environment
     */
    private format(level: LogLevel, message: string, meta: LogMeta = {}): string {
        const timestamp = new Date().toISOString();

        // Production: Clean, human-readable format
        if (this.isProduction) {
            // Only show timestamp and message for non-error logs
            if (level === 'error') {
                const errorStr = meta.error ? ` - ${String(meta.error)}` : '';
                return `${timestamp} [ERROR] ${message}${errorStr}`;
            }
            return `${timestamp} [${level.toUpperCase()}] ${message}`;
        }

        // Development: Structured JSON with full metadata
        const logObj = {
            timestamp,
            level,
            message,
            ...meta
        };

        return JSON.stringify(logObj, null, 2);
    }

    /**
     * Normalize meta parameter - accepts unknown for flexibility
     */
    private normalizeMeta(meta: unknown): LogMeta {
        if (meta === undefined || meta === null) {
            return {};
        }
        if (typeof meta === 'object' && !Array.isArray(meta)) {
            return meta as LogMeta;
        }
        // Wrap non-object values
        return { value: meta };
    }

    /**
     * Core logging method
     */
    private log(level: LogLevel, message: string, meta: unknown = {}): void {
        // Check if this level should be logged
        if (LOG_LEVELS[level] > LOG_LEVELS[this.level]) {
            return;
        }
        const normalizedMeta = this.normalizeMeta(meta);
        const formatted = this.format(level, message, normalizedMeta);

        // Use appropriate console method
        if (level === 'error') {
            console.error(formatted);
        } else if (level === 'warn') {
            console.warn(formatted);
        } else {
            console.log(formatted);
        }
    }

    /**
     * Log error message
     * @param message - Error message
     * @param meta - Additional metadata (e.g., { error: err.message, stack: err.stack })
     */
    error(message: string, meta?: unknown): void {
        this.log('error', message, meta);
    }

    /**
     * Log warning message
     * @param message - Warning message
     * @param meta - Additional metadata
     */
    warn(message: string, meta?: unknown): void {
        this.log('warn', message, meta);
    }

    /**
     * Log info message
     * @param message - Info message
     * @param meta - Additional metadata
     */
    info(message: string, meta?: unknown): void {
        this.log('info', message, meta);
    }

    /**
     * Log debug message (only in development with LOG_LEVEL=debug)
     * @param message - Debug message
     * @param meta - Additional metadata
     */
    debug(message: string, meta?: unknown): void {
        this.log('debug', message, meta);
    }

    /**
     * Log startup information (always shown, formatted nicely)
     */
    startup(appName: string, config: StartupConfig = {}): void {
        const banner = `
╔═══════════════════════════════════════════════════════════╗
║  ${appName.padEnd(55)}                                    ║
╚═══════════════════════════════════════════════════════════╝`;

        console.log(banner);

        if (config.version) {
            this.info(`Version: ${config.version}`);
        }
        if (config.port) {
            this.info(`Server listening on port ${config.port}`);
        }
        if (config.env) {
            this.info(`Environment: ${config.env}`);
        }

        this.info('Server started successfully');
    }
}

// Export singleton instance
export default new Logger();

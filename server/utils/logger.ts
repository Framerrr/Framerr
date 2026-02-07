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
 *   logger.verbose('SSE stream connected');
 *   logger.debug('Parsing request', { body: req.body });
 *   logger.trace('SQL query', { sql: 'SELECT...' });
 *   logger.error('Database error', { error: err.message });
 */

type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'trace';

interface LogMeta {
    [key: string]: unknown;
}

interface LogLevels {
    error: number;
    warn: number;
    info: number;
    verbose: number;
    debug: number;
    trace: number;
}

interface StartupConfig {
    version?: string;
    port?: number;
    env?: string;
}

const LOG_LEVELS: LogLevels = {
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
    debug: 4,
    trace: 5
};

class Logger {
    private level: LogLevel;
    private isProduction: boolean;

    constructor() {
        // Get log level from environment, default to 'info'
        const envLevel = process.env.LOG_LEVEL || 'info';
        this.isProduction = process.env.NODE_ENV === 'production';

        // Validate log level
        if (!Object.prototype.hasOwnProperty.call(LOG_LEVELS, envLevel)) {
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
            // Stringify metadata if it has content
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
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
     * Core logging method
     */
    private log(level: LogLevel, message: string, meta: LogMeta = {}): void {
        // Check if this level should be logged
        if (LOG_LEVELS[level] > LOG_LEVELS[this.level]) {
            return;
        }

        const formatted = this.format(level, message, meta);

        // Add to log buffer for Debug UI
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const logBufferModule = require('./logBuffer');
            // Handle both CommonJS and ES module interop
            const logBuffer = logBufferModule.default || logBufferModule;
            logBuffer.add(level, message, meta);
        } catch {
            // Ignore errors loading logBuffer (e.g., during startup)
        }

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
     */
    error(message: string, meta: LogMeta = {}): void {
        this.log('error', message, meta);
    }

    /**
     * Log warning message
     */
    warn(message: string, meta: LogMeta = {}): void {
        this.log('warn', message, meta);
    }

    /**
     * Log info message
     */
    info(message: string, meta: LogMeta = {}): void {
        this.log('info', message, meta);
    }

    /**
     * Log debug message (only in development with LOG_LEVEL=debug)
     */
    debug(message: string, meta: LogMeta = {}): void {
        this.log('debug', message, meta);
    }

    /**
     * Log verbose message (operational details, for power users/sysadmins)
     * Shown when LOG_LEVEL=verbose or higher
     */
    verbose(message: string, meta: LogMeta = {}): void {
        this.log('verbose', message, meta);
    }

    /**
     * Log trace message (deepest level, internal state dumps, SQL queries)
     * Shown only when LOG_LEVEL=trace
     */
    trace(message: string, meta: LogMeta = {}): void {
        this.log('trace', message, meta);
    }

    /**
     * Log startup information (always shown, formatted nicely)
     */
    startup(appName: string, config: StartupConfig = {}): void {
        const banner = `
╔═══════════════════════════════════════════════════════════╗
║  ${appName.padEnd(55)}  ║
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

    /**
     * Set log level dynamically at runtime
     */
    setLevel(level: string): void {
        const lowercaseLevel = level.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(LOG_LEVELS, lowercaseLevel)) {
            this.level = lowercaseLevel as LogLevel;
            this.info(`Log level changed to: ${lowercaseLevel}`);
        } else {
            console.warn(`Invalid log level "${level}". Valid levels: error, warn, info, verbose, debug, trace`);
        }
    }
}

// Export singleton instance
export default new Logger();

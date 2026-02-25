/**
 * Integration Adapter Error Types
 * 
 * Structured error classification for all adapter HTTP operations.
 * Every error flowing through BaseAdapter gets classified into one
 * of these codes, enabling consistent error handling across the app.
 * 
 * @module server/integrations/errors
 */

// ============================================================================
// ERROR CODES
// ============================================================================

export type AdapterErrorCode =
    | 'CONFIG_INVALID'      // Missing URL, API key, etc.
    | 'AUTH_FAILED'         // 401/403 — credentials wrong or expired
    | 'SERVICE_UNREACHABLE' // ECONNREFUSED, ETIMEDOUT — service is down
    | 'SERVICE_ERROR'       // 5xx — service is up but erroring
    | 'REQUEST_ERROR'       // Other HTTP errors (404, 400, etc.)
    | 'NETWORK_ERROR';      // DNS failure, SSL error, etc.

// ============================================================================
// ADAPTER ERROR CLASS
// ============================================================================

/**
 * Typed error thrown by BaseAdapter methods.
 * 
 * Consumers can switch on `error.code` to provide user-facing messages:
 * - AUTH_FAILED → "Reconnect needed"
 * - SERVICE_UNREACHABLE → "Service offline"
 * - CONFIG_INVALID → "Check integration settings"
 */
export class AdapterError extends Error {
    public readonly name = 'AdapterError';

    constructor(
        public readonly code: AdapterErrorCode,
        message: string,
        public readonly context?: Record<string, unknown>
    ) {
        super(message);
    }
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

interface AxiosLikeError {
    response?: { status: number; data?: unknown };
    code?: string;
    message: string;
}

/**
 * Classify a raw error (typically from axios) into an AdapterError.
 * Used internally by BaseAdapter.request().
 */
export function classifyError(
    error: unknown,
    integrationName: string
): AdapterError {
    const axiosErr = error as AxiosLikeError;

    // HTTP response errors (server responded)
    if (axiosErr.response) {
        const status = axiosErr.response.status;

        if (status === 401 || status === 403) {
            return new AdapterError('AUTH_FAILED',
                `Authentication failed for ${integrationName} (HTTP ${status})`,
                { status, integrationName }
            );
        }

        if (status >= 500) {
            return new AdapterError('SERVICE_ERROR',
                `${integrationName} returned server error (HTTP ${status})`,
                { status, integrationName }
            );
        }

        return new AdapterError('REQUEST_ERROR',
            `${integrationName} request failed (HTTP ${status})`,
            { status, integrationName }
        );
    }

    // Network-level errors (no response received)
    if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ETIMEDOUT' || axiosErr.code === 'ECONNABORTED') {
        return new AdapterError('SERVICE_UNREACHABLE',
            `Cannot reach ${integrationName}: ${axiosErr.code}`,
            { code: axiosErr.code, integrationName }
        );
    }

    // All other errors (DNS failure, SSL error, etc.)
    return new AdapterError('NETWORK_ERROR',
        `Network error for ${integrationName}: ${axiosErr.message || 'Unknown error'}`,
        { integrationName }
    );
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract a human-readable error message from any error type.
 */
export function extractAdapterErrorMessage(error: unknown): string {
    if (error instanceof AdapterError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

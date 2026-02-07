/**
 * API Error Types
 * Standardized error handling for all API requests
 */

export type ApiErrorCode =
    | 'NETWORK_ERROR'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'CONFLICT'
    | 'SERVER_ERROR'
    | 'TIMEOUT'
    | 'UNKNOWN';

export interface ApiErrorDetails {
    code: ApiErrorCode;
    message: string;
    status?: number;
    field?: string; // For validation errors
    originalError?: unknown;
}

/**
 * Custom API Error class
 * Provides consistent error structure across all API calls
 */
export class ApiError extends Error {
    code: ApiErrorCode;
    status?: number;
    field?: string;
    originalError?: unknown;

    constructor(details: ApiErrorDetails) {
        super(details.message);
        this.name = 'ApiError';
        this.code = details.code;
        this.status = details.status;
        this.field = details.field;
        this.originalError = details.originalError;
    }

    /**
     * Check if error is a specific type
     */
    is(code: ApiErrorCode): boolean {
        return this.code === code;
    }

    /**
     * Check if error is an authentication/authorization issue
     */
    isAuthError(): boolean {
        return this.code === 'UNAUTHORIZED' || this.code === 'FORBIDDEN';
    }

    /**
     * Check if error is retryable (network issues, timeouts)
     */
    isRetryable(): boolean {
        return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
    }
}

/**
 * Map HTTP status codes to error codes
 */
export function statusToErrorCode(status: number): ApiErrorCode {
    switch (status) {
        case 401:
            return 'UNAUTHORIZED';
        case 403:
            return 'FORBIDDEN';
        case 404:
            return 'NOT_FOUND';
        case 409:
            return 'CONFLICT';
        case 422:
            return 'VALIDATION_ERROR';
        case 500:
        case 502:
        case 503:
        case 504:
            return 'SERVER_ERROR';
        default:
            return status >= 400 && status < 500 ? 'VALIDATION_ERROR' : 'SERVER_ERROR';
    }
}

/**
 * Extract user-friendly error message from API response
 */
export function extractErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message;
    }

    // Axios error with response
    if (typeof error === 'object' && error !== null) {
        const axiosError = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
        if (axiosError.response?.data?.error) {
            return axiosError.response.data.error;
        }
        if (axiosError.response?.data?.message) {
            return axiosError.response.data.message;
        }
        if (axiosError.message) {
            return axiosError.message;
        }
    }

    return 'An unexpected error occurred';
}

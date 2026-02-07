/**
 * Shared API Types
 * Common type definitions for API requests and responses
 */

/**
 * Standard API response wrapper
 * All API endpoints should return this structure
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
}

/**
 * Paginated response for list endpoints
 */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

/**
 * Common ID types
 */
export type UserId = string;
export type IntegrationId = string;
export type WidgetId = string;
export type TemplateId = number;

/**
 * Common request options
 */
export interface RequestOptions {
    signal?: AbortSignal;
    timeout?: number;
}

/**
 * Mutation result type for create/update operations
 */
export interface MutationResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * API Module - Barrel Export
 * 
 * Central export point for all API functionality.
 * Components should import from 'src/api' or 'src/api/hooks'
 */

// Core client
export { api, apiClient, setNotificationFunctions, setLogoutFunction, setLoggingOut, resetSessionExpiredFlag } from './client';

// Error types and utilities
export { ApiError, statusToErrorCode, extractErrorMessage } from './errors';
export type { ApiErrorCode, ApiErrorDetails } from './errors';

// Shared types
export type { ApiResponse, PaginatedResponse, MutationResult, RequestOptions, UserId, IntegrationId, WidgetId, TemplateId } from './types';

// Endpoints
export * from './endpoints';

// React Query Hooks
export * from './hooks';

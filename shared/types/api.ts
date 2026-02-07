/**
 * API Types
 * Shared request/response types for API contracts
 */

/**
 * Generic API success response
 */
export interface ApiSuccessResponse<T = unknown> {
    success?: true;
    data?: T;
    message?: string;
}

/**
 * API error format
 */
export interface ApiError {
    code?: string;
    message: string;
}

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
    success?: false;
    error: string | ApiError;
}

/**
 * Union type for any API response
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Helper to check if response is an error
 */
export function isApiError(response: ApiResponse): response is ApiErrorResponse {
    return 'error' in response;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

// ============================================
// Specific API Response Types
// ============================================

import type { User } from './user';
import type { SidebarTab, TabGroup } from './tab';
import type { FramerrWidget } from './widget';
import type { Notification } from './notification';

/**
 * Auth API responses
 */
export interface LoginApiResponse {
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
}

export interface SetupStatusResponse {
    needsSetup: boolean;
}

export interface MeApiResponse {
    user: User;
}

/**
 * Tabs API responses
 */
export interface TabsApiResponse {
    tabs: SidebarTab[];
}

export interface TabGroupsApiResponse {
    groups: TabGroup[];
}

/**
 * Widgets API responses
 */
export interface WidgetsApiResponse {
    widgets: FramerrWidget[];
}

/**
 * Notifications API responses
 */
export interface NotificationsApiResponse {
    notifications: Notification[];
    unreadCount: number;
    totalCount: number;
}

/**
 * User settings response
 */
export interface UserSettingsResponse {
    serverName?: string;
    serverIcon?: string;
    greeting?: string;
    flattenUI?: boolean;
    customColors?: Record<string, string>;
    theme?: string;
}

/**
 * Profile API response
 */
export interface ProfileResponse {
    username: string;
    displayName?: string;
    email?: string;
    profilePicture?: string;
}

/**
 * Branding API response (public endpoint)
 */
export interface BrandingResponse {
    appName: string;
    appIcon?: string;
}

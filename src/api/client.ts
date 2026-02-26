/**
 * API Client
 * Centralized axios instance with interceptors for all API requests
 * 
 * This is the ONLY place axios should be imported in the frontend.
 * All components should use hooks from src/api/hooks/ instead.
 */
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ApiError, statusToErrorCode } from './errors';

// Types for notification and logout callbacks
type ErrorNotifyFn = (title: string, message: string) => void;
type LogoutFn = () => void;

// Store references to callbacks (set by providers)
let showErrorFn: ErrorNotifyFn | null = null;
let logoutFn: LogoutFn | null = null;
let isLoggingOut = false;
let hasShownSessionExpiredToast = false;

/**
 * Set the notification function for error toasts
 * Called from NotificationProvider
 */
export const setNotificationFunctions = (error: ErrorNotifyFn | null): void => {
    showErrorFn = error;
};

/**
 * Set the logout function for session expiry handling
 * Called from AuthContext
 */
export const setLogoutFunction = (logout: LogoutFn | null): void => {
    logoutFn = logout;
};

/**
 * Set logging out flag to prevent 401 handler during explicit logout
 */
export const setLoggingOut = (value: boolean): void => {
    isLoggingOut = value;
};

/**
 * Reset session expired toast flag - call from Login page on mount
 */
export const resetSessionExpiredFlag = (): void => {
    hasShownSessionExpiredToast = false;
};

// Endpoints where 401 is expected (login attempts, etc.)
const AUTH_ENDPOINTS = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/me',
    '/api/auth/setup',
    '/api/auth/plex-setup',
];

/**
 * Create configured axios instance
 */
function createApiClient(): AxiosInstance {
    const client = axios.create({
        timeout: 30000, // 30 second default timeout
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // REQUEST interceptor
    client.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
            // Add CSRF protection header
            config.headers['X-Framerr-Client'] = '1';

            // Block requests during logout (except logout itself)
            if (isLoggingOut && !config.url?.includes('/api/auth/logout')) {
                return Promise.reject(new Error('Request blocked - logout in progress'));
            }

            return config;
        }
    );

    // RESPONSE interceptor
    client.interceptors.response.use(
        (response) => response,
        (error: AxiosError) => {
            // Handle 401 Unauthorized
            if (error.response?.status === 401) {
                const requestUrl = error.config?.url || '';
                const isAuthEndpoint = AUTH_ENDPOINTS.some(ep => requestUrl.includes(ep));
                const isLoginPage = window.location.pathname.includes('login');
                const isSetupPage = window.location.pathname.includes('setup');

                // Show session expired only for unexpected 401s
                if (!isAuthEndpoint && !isLoginPage && !isSetupPage && !isLoggingOut && !hasShownSessionExpiredToast) {
                    hasShownSessionExpiredToast = true;
                    showErrorFn?.('Session Expired', 'Please log in again');
                    logoutFn?.();
                }
            }

            // Transform to ApiError
            const status = error.response?.status;
            const responseData = error.response?.data as { error?: string; message?: string } | undefined;
            const message = responseData?.error || responseData?.message || error.message || 'Request failed';

            const apiError = new ApiError({
                code: status ? statusToErrorCode(status) : 'NETWORK_ERROR',
                message,
                status,
                originalError: error,
            });

            return Promise.reject(apiError);
        }
    );

    return client;
}

/**
 * The singleton API client instance
 * Use this for all API requests
 */
export const apiClient = createApiClient();

/**
 * Convenience methods that return typed responses
 */
export const api = {
    get: <T>(url: string, config?: Parameters<typeof apiClient.get>[1]) =>
        apiClient.get<T>(url, config).then(res => res.data),

    post: <T>(url: string, data?: unknown, config?: Parameters<typeof apiClient.post>[2]) =>
        apiClient.post<T>(url, data, config).then(res => res.data),

    put: <T>(url: string, data?: unknown, config?: Parameters<typeof apiClient.put>[2]) =>
        apiClient.put<T>(url, data, config).then(res => res.data),

    patch: <T>(url: string, data?: unknown, config?: Parameters<typeof apiClient.patch>[2]) =>
        apiClient.patch<T>(url, data, config).then(res => res.data),

    delete: <T>(url: string, config?: Parameters<typeof apiClient.delete>[1]) =>
        apiClient.delete<T>(url, config).then(res => res.data),
};

export default api;

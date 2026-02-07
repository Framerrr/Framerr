/**
 * Axios interceptor setup for global error handling
 * Shows toast notifications for authentication errors (401)
 * Auto-triggers logout on session expiry
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Types
type ErrorNotifyFn = (title: string, message: string) => void;
type LogoutFn = () => void;

interface NotificationFunctions {
    error: ErrorNotifyFn;
}

// Store reference to notification and logout functions (set by providers)
let showErrorFn: ErrorNotifyFn | null = null;
let logoutFn: LogoutFn | null = null;
let isLoggingOut = false; // Flag to prevent 401 handler during explicit logout
let hasShownSessionExpiredToast = false; // Debounce flag for duplicate session expired toasts

/**
 * Set the notification functions for the interceptor to use
 * Called from a component inside NotificationProvider
 */
export const setNotificationFunctions = (fns: NotificationFunctions | null): void => {
    showErrorFn = fns?.error ?? null;
};

/**
 * Set the logout function for the interceptor to use
 * Called from AuthContext after logout function is available
 */
export const setLogoutFunction = (logout: LogoutFn | null): void => {
    logoutFn = logout;
};

/**
 * Set logging out flag to prevent 401 handler from firing during explicit logout
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

// URLs where 401 is expected and should NOT show "session expired"
const AUTH_ENDPOINTS: string[] = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/me',
    '/api/auth/setup',
    '/api/auth/plex-setup'  // Plex setup flow returns 401 for invalid creds
];

// REQUEST interceptor - add CSRF header and block requests during logout
// CSRF header (X-Framerr-Client) prevents cross-site request forgery attacks
axios.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Add CSRF protection header to all requests
        config.headers['X-Framerr-Client'] = '1';

        if (isLoggingOut && !config.url?.includes('/api/auth/logout')) {
            // Block all requests except the logout request itself
            return Promise.reject(new Error('Request blocked - logout in progress'));
        }
        return config;
    }
);

// Response interceptor for 401 errors
// Handles session expiry by showing toast and triggering logout
axios.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            const requestUrl = error.config?.url || '';

            // Check if this is an auth endpoint (expected 401)
            const isAuthEndpoint = AUTH_ENDPOINTS.some(endpoint =>
                requestUrl.includes(endpoint)
            );

            // Check if on login/setup page
            const isLoginPage = window.location.hash.includes('login');
            const isSetupPage = window.location.hash.includes('setup');

            // Only handle unexpected 401s (actual session expiry)
            // Skip if we're in the middle of an explicit logout to prevent race conditions
            // Use debounce flag to prevent multiple toasts when several requests fail with 401 simultaneously
            if (!isAuthEndpoint && !isLoginPage && !isSetupPage && !isLoggingOut && !hasShownSessionExpiredToast) {
                hasShownSessionExpiredToast = true;
                if (showErrorFn) {
                    showErrorFn('Session Expired', 'Please log in again');
                }
                // Trigger logout to redirect to login page
                if (logoutFn) {
                    logoutFn();
                }
            }
        }
        return Promise.reject(error);
    }
);

export default axios;

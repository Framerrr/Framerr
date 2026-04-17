/**
 * Unit tests for the API client 401 interceptor
 * 
 * Verifies the session-expiry handling logic:
 * - Regular 401s trigger toast + logout
 * - AUTH_ENDPOINTS 401s are silenced
 * - _sessionVerification flag overrides AUTH_ENDPOINTS exemption
 * - Debounce prevents duplicate toasts
 * - isLoggingOut and page guards prevent false triggers
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, setNotificationFunctions, setLogoutFunction, setLoggingOut, resetSessionExpiredFlag } from './client';

let mock: MockAdapter;

beforeEach(() => {
    mock = new MockAdapter(apiClient);
});

afterEach(() => {
    mock?.restore();
    // Clean up module state
    setNotificationFunctions(null);
    setLogoutFunction(null);
    setLoggingOut(false);
    resetSessionExpiredFlag();
});

describe('client.ts 401 interceptor', () => {
    it('fires toast + logout for regular 401 on non-auth endpoint', async () => {
        const errorFn = vi.fn();
        const logoutFn = vi.fn();
        setNotificationFunctions(errorFn);
        setLogoutFunction(logoutFn);

        mock.onGet('/api/widgets').reply(401);

        await expect(apiClient.get('/api/widgets')).rejects.toThrow();

        expect(errorFn).toHaveBeenCalledWith('Session Expired', 'Please log in again');
        expect(logoutFn).toHaveBeenCalledOnce();
    });

    it('silences 401 on AUTH_ENDPOINT (/api/auth/login)', async () => {
        const errorFn = vi.fn();
        const logoutFn = vi.fn();
        setNotificationFunctions(errorFn);
        setLogoutFunction(logoutFn);

        mock.onPost('/api/auth/login').reply(401);

        await expect(apiClient.post('/api/auth/login', {})).rejects.toThrow();

        expect(errorFn).not.toHaveBeenCalled();
        expect(logoutFn).not.toHaveBeenCalled();
    });

    it('silences 401 on /api/auth/me without _sessionVerification (cold-start safe)', async () => {
        const errorFn = vi.fn();
        const logoutFn = vi.fn();
        setNotificationFunctions(errorFn);
        setLogoutFunction(logoutFn);

        mock.onGet('/api/auth/me').reply(401);

        // Regular getSession() call — no config flag
        await expect(apiClient.get('/api/auth/me')).rejects.toThrow();

        expect(errorFn).not.toHaveBeenCalled();
        expect(logoutFn).not.toHaveBeenCalled();
    });

    it('fires toast + logout on /api/auth/me WITH _sessionVerification (tab-wake fix)', async () => {
        const errorFn = vi.fn();
        const logoutFn = vi.fn();
        setNotificationFunctions(errorFn);
        setLogoutFunction(logoutFn);

        mock.onGet('/api/auth/me').reply(401);

        // verifySession() call — with config flag
        await expect(
            apiClient.get('/api/auth/me', { _sessionVerification: true })
        ).rejects.toThrow();

        expect(errorFn).toHaveBeenCalledWith('Session Expired', 'Please log in again');
        expect(logoutFn).toHaveBeenCalledOnce();
    });

    it('silences 401 while isLoggingOut is true', async () => {
        const errorFn = vi.fn();
        const logoutFn = vi.fn();
        setNotificationFunctions(errorFn);
        setLogoutFunction(logoutFn);
        setLoggingOut(true);

        mock.onGet('/api/widgets').reply(401);

        // The request interceptor blocks non-logout requests during logout,
        // so we test with the logout endpoint itself
        mock.onPost('/api/auth/logout').reply(401);
        await expect(apiClient.post('/api/auth/logout', {})).rejects.toThrow();

        expect(errorFn).not.toHaveBeenCalled();
        expect(logoutFn).not.toHaveBeenCalled();
    });

    it('debounces: second 401 after first already fired', async () => {
        const errorFn = vi.fn();
        const logoutFn = vi.fn();
        setNotificationFunctions(errorFn);
        setLogoutFunction(logoutFn);

        mock.onGet('/api/widgets').reply(401);
        mock.onGet('/api/settings').reply(401);

        // First 401 — should fire
        await expect(apiClient.get('/api/widgets')).rejects.toThrow();
        expect(errorFn).toHaveBeenCalledOnce();
        expect(logoutFn).toHaveBeenCalledOnce();

        // Second 401 — should be debounced
        await expect(apiClient.get('/api/settings')).rejects.toThrow();
        expect(errorFn).toHaveBeenCalledOnce(); // still 1
        expect(logoutFn).toHaveBeenCalledOnce(); // still 1

        // After reset, should fire again
        resetSessionExpiredFlag();
        await expect(apiClient.get('/api/widgets')).rejects.toThrow();
        expect(errorFn).toHaveBeenCalledTimes(2);
        expect(logoutFn).toHaveBeenCalledTimes(2);
    });

    it('silences 401 on login page', async () => {
        const errorFn = vi.fn();
        const logoutFn = vi.fn();
        setNotificationFunctions(errorFn);
        setLogoutFunction(logoutFn);

        // Mock window.location.pathname for login page
        const originalPathname = window.location.pathname;
        Object.defineProperty(window, 'location', {
            value: { ...window.location, pathname: '/login' },
            writable: true,
            configurable: true,
        });

        mock.onGet('/api/widgets').reply(401);

        await expect(apiClient.get('/api/widgets')).rejects.toThrow();

        expect(errorFn).not.toHaveBeenCalled();
        expect(logoutFn).not.toHaveBeenCalled();

        // Restore
        Object.defineProperty(window, 'location', {
            value: { ...window.location, pathname: originalPathname },
            writable: true,
            configurable: true,
        });
    });
});

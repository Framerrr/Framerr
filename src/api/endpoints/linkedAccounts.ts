/**
 * Linked Accounts API Endpoints
 * Plex and Overseerr account linking management
 */
import { api } from '../client';
import { ApiResponse } from '../types';

// Types
export interface LinkedAccount {
    id?: string;
    username?: string;
    email?: string;
    linkedAt?: string;
}

export interface LinkedAccounts {
    plex?: LinkedAccount;
    overseerr?: LinkedAccount;
}



// Endpoints
export const linkedAccountsApi = {
    /**
     * Get current user's linked accounts
     */
    getMyAccounts: () =>
        api.get<{ accounts?: LinkedAccounts }>('/api/linked-accounts/me'),

    /**
     * Link Plex account
     */
    linkPlex: (plexToken: string) =>
        api.post<ApiResponse<void>>('/api/linked-accounts/plex', { plexToken }),

    /**
     * Unlink Plex account
     */
    unlinkPlex: () =>
        api.delete<ApiResponse<void>>('/api/linked-accounts/plex'),

    /**
     * Link Overseerr account
     */
    linkOverseerr: (username: string, password: string) =>
        api.post<ApiResponse<void>>('/api/linked-accounts/overseerr', { username, password }),

    /**
     * Unlink Overseerr account
     */
    unlinkOverseerr: () =>
        api.delete<ApiResponse<void>>('/api/linked-accounts/overseerr'),

};

export default linkedAccountsApi;

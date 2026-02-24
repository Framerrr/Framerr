/**
 * Tabs API Endpoints
 * Sidebar tab management
 */
import { api } from '../client';
import { ApiResponse } from '../types';

// Types
export interface Tab {
    id: string;
    name: string;
    url: string;
    slug?: string;
    icon?: string;
    groupId?: string;
    enabled?: boolean;
    openInNewTab?: boolean;
    order?: number;
}

export interface TabGroup {
    id: string;
    name: string;
}

export interface CreateTabData {
    name: string;
    url: string;
    icon?: string;
    groupId?: string;
    enabled?: boolean;
    openInNewTab?: boolean;
}

export interface UpdateTabData {
    name?: string;
    url?: string;
    icon?: string;
    groupId?: string;
    enabled?: boolean;
    openInNewTab?: boolean;
}

// Endpoints
export const tabsApi = {
    /**
     * Get all tabs
     */
    getAll: () =>
        api.get<{ tabs: Tab[] }>('/api/tabs'),

    /**
     * Create new tab
     */
    create: (data: CreateTabData) =>
        api.post<ApiResponse<Tab>>('/api/tabs', data),

    /**
     * Update tab
     */
    update: (id: string, data: UpdateTabData) =>
        api.put<ApiResponse<Tab>>(`/api/tabs/${id}`, data),

    /**
     * Delete tab
     */
    delete: (id: string) =>
        api.delete<ApiResponse<void>>(`/api/tabs/${id}`),

    /**
     * Reorder tabs
     */
    reorder: (orderedIds: string[]) =>
        api.put<void>('/api/tabs/reorder', { orderedIds }),
};

export default tabsApi;

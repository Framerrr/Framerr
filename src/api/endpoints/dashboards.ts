/**
 * Dashboards API Endpoints
 */
import { api } from '../client';
import type { MobileLayoutMode } from './widgets';

export interface DashboardMeta {
    id: string;
    userId: string;
    name: string;
    /** IconPicker id; null = LayoutDashboard default */
    icon: string | null;
    fixedDisplay: boolean;
    mobileLayoutMode: MobileLayoutMode;
    position: number;
    widgetCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface DashboardsResponse {
    dashboards: DashboardMeta[];
    homeDashboardId: string;
    rememberLastDashboard: boolean;
}

export interface DashboardDetail {
    id: string;
    userId: string;
    name: string;
    icon: string | null;
    fixedDisplay: boolean;
    widgets: unknown[];
    mobileLayoutMode: MobileLayoutMode;
    mobileWidgets?: unknown[];
    position: number;
    createdAt: string;
    updatedAt: string;
}

export type CreateDashboardSource =
    | { type: 'blank' }
    | { type: 'clone'; dashboardId: string }
    | { type: 'template'; templateId: string };

export interface CreateDashboardData {
    name?: string;
    source?: CreateDashboardSource;
}

export interface UpdateDashboardData {
    name?: string;
    position?: number;
    icon?: string | null;
    fixedDisplay?: boolean;
}

export interface DashboardPreferencesData {
    homeDashboardId?: string;
    rememberLastDashboard?: boolean;
}

export const dashboardsApi = {
    list: () => api.get<DashboardsResponse>('/api/dashboards'),

    create: (data: CreateDashboardData) =>
        api.post<{ dashboard: DashboardDetail }>('/api/dashboards', data),

    update: (id: string, data: UpdateDashboardData) =>
        api.patch<{ dashboard: DashboardDetail }>(`/api/dashboards/${id}`, data),

    remove: (id: string) =>
        api.delete<DashboardsResponse>(`/api/dashboards/${id}`),

    setPreferences: (data: DashboardPreferencesData) =>
        api.put<{ homeDashboardId: string; rememberLastDashboard: boolean }>(
            '/api/dashboards/preferences',
            data
        ),
};

export default dashboardsApi;

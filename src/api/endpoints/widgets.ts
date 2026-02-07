/**
 * Widgets API Endpoints
 * Widget CRUD and dashboard layout
 */
import { api } from '../client';
import { ApiResponse, WidgetId } from '../types';

// Types
export interface WidgetLayout {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface WidgetConfig {
    title?: string;
    customIcon?: string;
    integrationId?: string;
    [key: string]: unknown;
}

/**
 * Widget type for API communication
 * Uses FramerrWidget format: layout (desktop) + optional mobileLayout
 */
export interface Widget {
    id: WidgetId;
    type: string;
    layout: WidgetLayout;
    mobileLayout?: WidgetLayout;
    config?: WidgetConfig;
}

export interface DashboardLayout {
    widgets: Widget[];
}

export interface UpdateWidgetData {
    type?: string;
    layout?: WidgetLayout;
    mobileLayout?: WidgetLayout;
    config?: Record<string, unknown>;
}

export type MobileLayoutMode = 'linked' | 'independent';

export interface WidgetsResponse {
    widgets: Widget[];
    mobileWidgets?: Widget[];
    mobileLayoutMode?: MobileLayoutMode;
}

export interface SaveWidgetsData {
    widgets: Widget[];
    mobileLayoutMode?: MobileLayoutMode;
    mobileWidgets?: Widget[];
}

// Endpoints
export const widgetsApi = {
    /**
     * Get all widgets (desktop + mobile)
     * Used by settings/dashboard
     */
    getAll: () =>
        api.get<WidgetsResponse>('/api/widgets'),

    /**
     * Save all widgets (full layout update)
     * Used by settings/dashboard
     */
    saveAll: (data: SaveWidgetsData) =>
        api.put<void>('/api/widgets', data),

    /**
     * Get dashboard layout with all widgets (legacy)
     */
    getDashboard: () =>
        api.get<DashboardLayout>('/api/dashboard'),

    /**
     * Save entire dashboard layout (legacy)
     */
    saveDashboard: (layout: DashboardLayout) =>
        api.put<ApiResponse<void>>('/api/dashboard', layout),

    /**
     * Add widget to dashboard
     */
    addWidget: (widget: Omit<Widget, 'id'>) =>
        api.post<ApiResponse<Widget>>('/api/dashboard/widgets', widget),

    /**
     * Update widget
     */
    updateWidget: (id: WidgetId, data: UpdateWidgetData) =>
        api.put<ApiResponse<Widget>>(`/api/dashboard/widgets/${id}`, data),

    /**
     * Remove widget
     */
    removeWidget: (id: WidgetId) =>
        api.delete<ApiResponse<void>>(`/api/dashboard/widgets/${id}`),

    /**
     * Get widget type access for current user
     */
    getMyAccess: () =>
        api.get<{ widgets: string[] | 'all' }>('/api/widget-shares/my-access'),

    /**
     * Reconnect mobile layout to desktop (resync)
     */
    reconnectMobile: () =>
        api.post<void>('/api/widgets/reconnect'),

    /**
     * Reset all widgets (clear dashboard)
     */
    reset: () =>
        api.post<void>('/api/widgets/reset'),

    /**
     * Update a single widget's config
     * Used by automatic fallback persistence to avoid full dashboard save
     */
    updateWidgetConfig: (widgetId: WidgetId, config: Record<string, unknown>) =>
        api.patch<{ success: boolean }>(`/api/widgets/${widgetId}/config`, { config }),
};

export default widgetsApi;

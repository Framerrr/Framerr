/**
 * Widgets API Endpoints
 * Widget CRUD and dashboard layout (scoped per dashboard)
 */
import { api } from '../client';
import { WidgetId } from '../types';

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

function widgetsBase(dashboardId: string): string {
    return `/api/dashboards/${dashboardId}/widgets`;
}

// Endpoints
export const widgetsApi = {
    getAll: (dashboardId: string) =>
        api.get<WidgetsResponse>(widgetsBase(dashboardId)),

    saveAll: (dashboardId: string, data: SaveWidgetsData) =>
        api.put<void>(widgetsBase(dashboardId), data),

    getMyAccess: () =>
        api.get<{ widgets: string[] | 'all' }>('/api/widget-shares/my-access'),

    reconnectMobile: (dashboardId: string) =>
        api.post<void>(`${widgetsBase(dashboardId)}/reconnect`),

    reset: (dashboardId: string) =>
        api.post<void>(`${widgetsBase(dashboardId)}/reset`),

    updateWidgetConfig: (
        dashboardId: string,
        widgetId: WidgetId,
        config: Record<string, unknown>
    ) =>
        api.patch<{ success: boolean }>(`${widgetsBase(dashboardId)}/${widgetId}/config`, {
            config,
        }),
};

export default widgetsApi;

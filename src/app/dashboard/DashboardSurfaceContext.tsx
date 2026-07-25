/**
 * Per-mounted dashboard surface visibility.
 * Inactive keep-alive dashboards stay mounted but should pause SSE/pollers.
 */
import React, { createContext, useContext, type ReactNode } from 'react';

export interface DashboardSurfaceValue {
    dashboardId: string;
    /** True when this dashboard instance is the visible surface */
    isActive: boolean;
}

const DashboardSurfaceContext = createContext<DashboardSurfaceValue | null>(null);

export function DashboardSurfaceProvider({
    dashboardId,
    isActive,
    children,
}: {
    dashboardId: string;
    isActive: boolean;
    children: ReactNode;
}): React.JSX.Element {
    return (
        <DashboardSurfaceContext.Provider value={{ dashboardId, isActive }}>
            {children}
        </DashboardSurfaceContext.Provider>
    );
}

export function useOptionalDashboardSurface(): DashboardSurfaceValue | null {
    return useContext(DashboardSurfaceContext);
}

/**
 * Shared types for backup route modules
 */

import { Request } from 'express';

export interface AuthenticatedUser {
    id: string;
    username: string;
    displayName?: string;
    group: string;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

export interface ImportedDashboardEntry {
    name: string;
    widgets?: unknown[];
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: unknown[];
    position: number;
    isHome?: boolean;
    fixedDisplay?: boolean;
}

export interface ImportData {
    /** v2 multi-dashboard payload */
    dashboards?: ImportedDashboardEntry[];
    rememberLastDashboard?: boolean;
    /** v1 legacy single-dashboard payload */
    dashboard?: unknown;
    tabs?: unknown;
    theme?: unknown;
    sidebar?: unknown;
}

export interface ImportBody {
    data: ImportData;
}

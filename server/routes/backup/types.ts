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

export interface ImportData {
    dashboard?: unknown;
    tabs?: unknown;
    theme?: unknown;
    sidebar?: unknown;
}

export interface ImportBody {
    data: ImportData;
}

/**
 * Tab Management Types
 * 
 * Shared types for the tabs feature domain.
 */

/** A user-defined sidebar tab */
export interface Tab {
    id: string;
    name: string;
    url: string;
    slug: string;
    icon?: string;
    groupId?: string;
    enabled?: boolean;
}

/** A tab group for organizing tabs */
export interface TabGroup {
    id: string;
    name: string;
    order?: number;
}

/** Form data for creating/editing tabs */
export interface TabFormData {
    name: string;
    url: string;
    icon: string;
    groupId: string;
    enabled: boolean;
}

/** Form data for creating/editing tab groups */
export interface TabGroupFormData {
    id: string;
    name: string;
    order: number;
}

/** Modal mode for create/edit dialogs */
export type ModalMode = 'create' | 'edit';

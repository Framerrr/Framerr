/**
 * User Management Types
 * 
 * Types for the user management feature (admin-only).
 */

/** User entity from the database */
export interface User {
    id: string;
    username: string;
    email?: string;
    group?: string;
    createdAt?: number;
    profilePictureUrl?: string;
}

/** Form data for creating/editing users */
export interface UserFormData {
    username: string;
    email: string;
    password: string;
    group: string;
    /** Custom group IDs (for sharing, not permissions) */
    groupIds: string[];
}

/** Temporary password display state after password reset */
export interface TempPassword {
    userId: string;
    password: string;
}

/** Modal mode for create/edit */
export type ModalMode = 'create' | 'edit';

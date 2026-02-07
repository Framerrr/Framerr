/**
 * Permission types and constants for the permissions feature
 */

// Types
export interface Permission {
    id: string;
    label: string;
    description: string;
    icon: string;
}

export interface PermissionGroup {
    id: string;
    name: string;
    permissions: string[];
}

export interface PermissionFormData {
    id: string;
    name: string;
    permissions: string[];
}

// Constants
/** System groups that cannot be deleted */
export const PROTECTED_GROUPS = ['admin', 'user', 'guest'];

/** Available permissions with descriptions */
export const AVAILABLE_PERMISSIONS: Permission[] = [
    { id: '*', label: 'Full Access (Admin)', description: 'Complete system access, overrides all other permissions', icon: '👑' },
    { id: 'view_dashboard', label: 'View Dashboard', description: 'Access to dashboard and navigation', icon: '📊' },
    { id: 'manage_widgets', label: 'Manage Widgets', description: 'Add, edit, and delete dashboard widgets', icon: '🧩' },
    { id: 'manage_system', label: 'Manage System', description: 'Access Settings page and system configuration', icon: '⚙️' },
    { id: 'manage_users', label: 'Manage Users', description: 'Create, edit, and delete user accounts', icon: '👥' }
];

/**
 * Link Library API Endpoints
 * CRUD operations for the user's link library (reusable templates)
 */
import { api } from '../client';
import type { LibraryLink } from '../../widgets/link-grid/components/LinkLibraryPicker';

// Types
export interface CreateLinkData {
    title: string;
    icon?: string;
    size?: 'circle' | 'rectangle';
    type?: 'link' | 'action';
    url?: string;
    style?: { showIcon?: boolean; showText?: boolean };
    action?: { method: string; url: string; headers?: Record<string, string>; body?: unknown };
}

export interface LinkLibraryResponse {
    links: LibraryLink[];
}

// Endpoints
export const linkLibraryApi = {
    /**
     * Get all library templates for current user
     */
    getAll: () =>
        api.get<LinkLibraryResponse>('/api/link-library'),

    /**
     * Create a new library template
     */
    create: (data: CreateLinkData) =>
        api.post<LibraryLink>('/api/link-library', data),

    /**
     * Delete a library template
     */
    delete: (id: string) =>
        api.delete<{ deleted: boolean }>(`/api/link-library/${id}`),
};

export default linkLibraryApi;

/**
 * Integrations API Endpoints
 * Integration instance management
 */
import { api } from '../client';
import { ApiResponse, IntegrationId } from '../types';

// Types
export interface IntegrationInstance {
    id: IntegrationId;
    type: string;
    name: string;
    displayName?: string;  // For /shared endpoint compatibility
    enabled: boolean;
    config?: IntegrationConfig;
    createdAt?: string;
    updatedAt?: string;
}

export interface IntegrationConfig {
    url?: string;
    apiKey?: string;
    username?: string;
    password?: string;
    [key: string]: unknown;
}

export interface CreateIntegrationData {
    type: string;
    name: string;
    config: IntegrationConfig;
    enabled?: boolean;
}

export interface UpdateIntegrationData {
    name?: string;
    config?: IntegrationConfig;
    enabled?: boolean;
}

// Schema types for dynamic form generation (P4 Phase 4.4)
export type FieldType = 'text' | 'password' | 'url' | 'number' | 'checkbox' | 'select';

export interface ConfigField {
    key: string;
    type: FieldType;
    label: string;
    placeholder?: string;
    hint?: string;
    required?: boolean;
    /** If true, this field's value is redacted in API responses (replaced with sentinel) */
    sensitive?: boolean;
    options?: Array<{ value: string; label: string }>;
    default?: string; // Default value (e.g., 'true' for checkboxes)
}

export interface ConfigSchema {
    fields: ConfigField[];
    infoMessage?: {
        icon?: 'info' | 'code' | 'lightbulb';
        title: string;
        content: string;
    };
}

export interface IntegrationSchemaInfo {
    name: string;
    description: string;
    category: 'system' | 'media' | 'management';
    icon?: string;
    configSchema: ConfigSchema;
    hasCustomForm: boolean;
    hasConnectionTest: boolean;
    metrics?: Array<{ key: string; recordable: boolean }>;
    notificationMode?: 'webhook' | 'local';
    notificationEvents?: Array<{ key: string; label: string; category?: string; adminOnly?: boolean; defaultAdmin?: boolean; defaultUser?: boolean }>;
}

export interface TestConnectionResult {
    success: boolean;
    message?: string;
    error?: string;
}

// Endpoints
export const integrationsApi = {
    /**
     * Get all integration instances
     */
    getAll: async (): Promise<IntegrationInstance[]> => {
        const response = await api.get<{ integrations: IntegrationInstance[] }>('/api/integrations');
        return response.integrations || [];
    },

    /**
     * Get all plugin schemas for form generation (P4 Phase 4.4)
     */
    getSchemas: async (): Promise<Record<string, IntegrationSchemaInfo>> => {
        const response = await api.get<{ schemas: Record<string, IntegrationSchemaInfo> }>('/api/integrations/schemas');
        return response.schemas;
    },

    /**
     * Get single integration by ID
     */
    getById: (id: IntegrationId) =>
        api.get<IntegrationInstance>(`/api/integrations/${id}`),

    /**
     * Create new integration
     */
    create: (data: CreateIntegrationData) =>
        api.post<ApiResponse<IntegrationInstance>>('/api/integrations', data),

    /**
     * Update integration
     */
    update: (id: IntegrationId, data: UpdateIntegrationData) =>
        api.put<ApiResponse<IntegrationInstance>>(`/api/integrations/${id}`, data),

    /**
     * Delete integration
     */
    delete: (id: IntegrationId) =>
        api.delete<ApiResponse<void>>(`/api/integrations/${id}`),

    /**
     * Test integration connection
     */
    testConnection: (id: IntegrationId) =>
        api.post<TestConnectionResult>(`/api/integrations/${id}/test`),

    /**
     * Get user-accessible integrations (for non-admins)
     */
    getAccessible: () =>
        api.get<IntegrationInstance[]>('/api/integrations/accessible'),

    /**
     * Get shared integrations for current user
     */
    getShared: () =>
        api.get<{ integrations: IntegrationInstance[] }>('/api/integrations/shared'),

    /**
     * Test integration connection with config (not saved instance)
     */
    testByConfig: (service: string, config: IntegrationConfig, instanceId?: string) =>
        api.post<TestConnectionResult>('/api/integrations/test', { service, config, instanceId }),

    /**
     * Bulk update integrations (for webhook configs)
     */
    updateAll: (integrations: Record<string, unknown>) =>
        api.put<void>('/api/integrations', { integrations }),

    /**
     * Get integrations by type
     */
    getByType: (type: string) =>
        api.get<{ instances: IntegrationInstance[] }>(`/api/integrations/by-type/${type}`),

    /**
     * Get legacy integration config (keyed object format)
     * Used by notification settings for webhook configs
     */
    getLegacyConfig: () =>
        api.get<Record<string, unknown>>('/api/integrations').then(response => {
            // Handle both array and object response formats
            if (Array.isArray(response)) {
                // New format: convert array to keyed object by type
                const keyed: Record<string, unknown> = {};
                response.forEach((inst: IntegrationInstance) => {
                    keyed[inst.type] = inst;
                });
                return keyed;
            }
            // Legacy format: already keyed object
            return (response as { integrations?: Record<string, unknown> }).integrations || response;
        }),

    /**
     * Get all integration shares (admin only)
     */
    getAllShares: () =>
        api.get<{ shares: Record<string, IntegrationShareRecord[]> }>('/api/integrations/all-shares'),

    /**
     * Revoke all shares for an integration (admin only)
     */
    revokeShares: (serviceName: string) =>
        api.delete<void>(`/api/integrations/${serviceName}/share`),
};

// Share record from database
export interface IntegrationShareRecord {
    id: string;
    integrationName: string;
    shareType: 'everyone' | 'user' | 'group';
    shareTarget: string | null;
    sharedBy: string;
    createdAt: string;
}

export default integrationsApi;


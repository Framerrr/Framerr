/**
 * Utility Types
 * Types for utility functions and helper modules
 */

import type { ComponentType, LazyExoticComponent } from 'react';
import type { WidgetCategory, WidgetTypeKey, WidgetLayout } from '../../shared/types/widget';

// Re-export WidgetLayout for convenience (canonical definition is in shared/types)
export type { WidgetLayout } from '../../shared/types/widget';

// ============================================
// Widget Registry Types
// ============================================

/**
 * Lucide icon component type
 */
export type LucideIcon = ComponentType<{ size?: number; className?: string }>;

/**
 * Widget size constraints
 */
export interface WidgetSize {
    w?: number;
    h?: number;
}

/**
 * Widget metadata in registry
 */
export interface WidgetMetadata {
    type?: string; // Added when retrieved via getWidgetsByCategory
    component: LazyExoticComponent<ComponentType<unknown>>;
    icon: LucideIcon;
    name: string;
    description: string;
    category: WidgetCategory;
    defaultSize: WidgetSize;
    minSize: WidgetSize;
    maxSize?: WidgetSize;
    /** Integration types this widget is compatible with */
    compatibleIntegrations?: string[];
    /** If true, widget uses ALL compatible integrations (e.g., Calendar) */
    multiIntegration?: boolean;
    defaultConfig?: Record<string, unknown>;
}

/**
 * Widget types registry
 */
export type WidgetTypesRegistry = Record<WidgetTypeKey | string, WidgetMetadata>;

// ============================================
// Logger Types
// ============================================

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogMeta {
    [key: string]: unknown;
}

export interface StartupConfig {
    version?: string;
    port?: number;
    env?: string;
}

export interface Logger {
    level: LogLevel;
    isProduction: boolean;
    error(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
    info(message: string, meta?: unknown): void;
    debug(message: string, meta?: unknown): void;
    startup(appName: string, config?: StartupConfig): void;
}

// ============================================
// Permissions Types
// ============================================

// Use the PermissionGroup from systemConfig context for frontend
// The server/types has its own version for backend

export interface SystemConfigWithPermissions {
    groups?: Array<{ id: string; permissions: string[] }>;
    [key: string]: unknown;
}

// ============================================
// Auth Detection Types
// ============================================

export type AuthSensitivity = 'conservative' | 'balanced' | 'aggressive';

export interface AuthDetectionResult {
    needsAuth: boolean;
    confidence: number;
    reasons: string[];
    threshold: number;
}

export interface IframeAuthConfig {
    enabled?: boolean;
    sensitivity?: AuthSensitivity;
    customPatterns?: string[];
}

// ============================================
// Layout Utils Types
// ============================================

export interface WidgetWithLayouts {
    id?: string;
    type: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    layouts?: {
        lg?: WidgetLayout;
        sm?: WidgetLayout;
        [key: string]: WidgetLayout | undefined;
    };
}

export type Breakpoint = 'lg' | 'sm';

// ============================================
// Axios Setup Types
// ============================================

export interface NotificationFunctions {
    error: (title: string, message: string) => void;
}

// ============================================
// Hook Return Types
// ============================================

export interface UseIntegrationResult {
    enabled: boolean;
    url?: string;
    apiKey?: string;
    token?: string;
    [key: string]: unknown;
}

export interface UseFetchIntegrationResult {
    data: null;
    loading: boolean;
    error: string | null;
}

export interface UseNotificationReturn {
    notify: (type: string, title: string, message: string, options?: unknown) => string;
    success: (title: string, message: string, options?: unknown) => string;
    error: (title: string, message: string, options?: unknown) => string;
    warning: (title: string, message: string, options?: unknown) => string;
    info: (title: string, message: string, options?: unknown) => string;
    dismiss: (id: string) => void;
}

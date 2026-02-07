/**
 * Frontend Types Index
 * Re-exports all frontend-specific types and shared types
 */

// Re-export shared types for convenience
export * from '../../shared/types';

// Context types
export * from './context/auth';
export * from './context/appData';
export * from './context/layout';
export * from './context/theme';
export * from './context/notification';
export * from './context/systemConfig';

// Component types
export * from './components/common';
export * from './components/widgets';

// Utility types - export specific types to avoid duplicate WidgetLayout
export type {
    LogLevel,
    LogMeta,
    StartupConfig,
    Logger,
    AuthSensitivity,
    AuthDetectionResult,
    IframeAuthConfig,
    WidgetWithLayouts,
    Breakpoint,
    NotificationFunctions,
    UseIntegrationResult,
    UseFetchIntegrationResult,
    UseNotificationReturn,
    LucideIcon,
    WidgetSize,
    WidgetMetadata,
    WidgetTypesRegistry,
    SystemConfigWithPermissions,
} from './utils';

// Event types
export * from './events';

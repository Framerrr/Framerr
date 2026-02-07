/**
 * Database Layer Barrel Export
 * 
 * Provides centralized exports for all database entity operations.
 * Import from this index for cleaner code:
 *   import { getUser, createTemplate, updateNotification } from '../db';
 * 
 * For bulk operations or namespace clarity, import entire modules:
 *   import * as usersDb from '../db/users';
 */

// User management
export * from './users';

// User configuration (tabs, theme, dashboard, etc.)
export * from './userConfig';

// System configuration
export * from './systemConfig';

// Templates (barrel)
export * from './templates';

// Service monitors (barrel)
export * from './serviceMonitors';

// Notifications
export * from './notifications';

// Integration instances
export * from './integrationInstances';

// Integration shares
export * from './integrationShares';

// Widget shares (exclude ShareType - already exported from integrationShares)
export {
    type WidgetShare,
    shareWidgetType,
    unshareWidgetType,
    getWidgetShares,
    getAllWidgetShares,
    userHasWidgetShare,
    getUserAccessibleWidgets,
    bulkUpdateWidgetShares
} from './widgetShares';

// User groups (custom sharing categories)
export * from './userGroups';

// Linked accounts (Plex, Overseerr)
export * from './linkedAccounts';

// Push subscriptions (Web Push)
export * from './pushSubscriptions';

// Custom icons
export * from './customIcons';

// Plex setup tokens
export * from './plexSetupTokens';

// Types (re-export from templates for convenience)
export * from './templates.types';

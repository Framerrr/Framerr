/**
 * Integration Feature Public API
 * 
 * Exports settings components, hooks, and types for the integration system.
 */

// Settings (from src/settings/integrations)
export { default as IntegrationSettings } from '../../settings/integrations/IntegrationSettings';
export { useIntegrationSettings } from '../../settings/integrations/hooks/useIntegrationSettings';

// Types
export type {
    IntegrationInstance,
    IntegrationsState,
    TestState,
    IntegrationConfig,
    PlexConfig
} from './types';

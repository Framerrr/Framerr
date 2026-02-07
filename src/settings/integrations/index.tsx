/**
 * Integration Settings Barrel Export
 */

// New router for the "Integrations" category
export { IntegrationsSettings } from './IntegrationsSettings';

// Legacy exports - IntegrationSettings is now ServiceSettingsPage
export { default as IntegrationSettings } from './IntegrationSettings';
export { useIntegrationSettings } from './hooks/useIntegrationSettings';


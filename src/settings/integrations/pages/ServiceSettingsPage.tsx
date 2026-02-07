/**
 * ServiceSettingsPage
 * 
 * Wrapper that imports the existing IntegrationSettings component
 * which manages service/integration configuration.
 * 
 * Note: The original IntegrationSettings.tsx in the parent folder
 * will be renamed/deleted during cleanup phase.
 */

// Re-export the existing IntegrationSettings as ServiceSettingsPage
// This maintains the existing functionality while aligning with new naming
export { default as ServiceSettingsPage } from '../IntegrationSettings';

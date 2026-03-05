/**
 * Test Utilities — Barrel Export
 *
 * Single import path for all test utilities:
 *   import { renderWithProviders, createMockUser, screen } from '@/test';
 */

// Custom render and RTL re-exports
export { renderWithProviders, screen, waitFor, within, act, userEvent } from './render';

// Mock factories
export { createMockUser, createMockWidget, createMockIntegrationInstance } from './mocks';

// Provider wrapper (for direct use if needed)
export { AllProviders } from './providers';

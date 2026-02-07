import { TestResult } from '../types';

// ============================================================================
// MONITOR CONNECTION TEST
// ============================================================================

/**
 * Test connection for Framerr's built-in monitoring.
 * Since this is a local database integration, the "test" simply confirms
 * that the integration is ready to use.
 */
export async function testConnection(_config: Record<string, unknown>): Promise<TestResult> {
    // Local integration - always succeeds as long as database is accessible
    // Actual database health is verified by app startup, not per-integration test
    return {
        success: true,
        message: 'Framerr Monitor is ready. Configure monitors in the Service Status widget.',
    };
}

/**
 * SSE Stream Service - Redirect
 * 
 * @deprecated PHASE: SSE-P1
 * @status PENDING_REMOVAL
 * @delete-phase Phase 9 (Final Cleanup)
 * @reason This redirect shim exists for import compatibility during SSE refactor.
 * 
 * All imports from this file continue to work.
 * Migration: Import directly from './sse' instead.
 * 
 * DO NOT DELETE until all imports are updated to use './sse' directly.
 */

// Re-export everything from the new SSE module
export * from './sse';

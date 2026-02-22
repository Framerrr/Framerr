/**
 * Integration Core Module Barrel Export
 * 
 * Re-exports all core integration functionality:
 * - CRUD router
 * - Test router
 * - Schema router
 * - Shared types
 */

// Routers
export { default as crudRouter } from './crud';
export { default as testRouter } from './test';
export { default as schemasRouter } from './schemas';
export { default as itemMetadataRouter } from './itemMetadata';

// Shared types
export * from './types';



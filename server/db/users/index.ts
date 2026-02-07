/**
 * Users Module Barrel Export
 * 
 * Aggregates all user and session operations.
 */

// Types
export * from './types';

// User CRUD
export {
    getUser,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    listUsers,
    getAllUsers,
    hasUsers
} from './crud';

// Session management
export {
    createSession,
    getSession,
    revokeSession,
    revokeAllUserSessions,
    getUserSessions,
    cleanupExpiredSessions
} from './sessions';

// Password operations
export {
    resetUserPassword,
    hasLocalPassword,
    setHasLocalPassword
} from './passwords';

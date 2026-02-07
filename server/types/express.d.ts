/**
 * Express Type Augmentation
 * Extends Express Request with Framerr-specific properties
 */

import type { User } from '../../shared/types/user';

declare global {
    namespace Express {
        interface Request {
            /**
             * Authenticated user attached by auth middleware
             */
            user?: User;

            /**
             * True if user was authenticated via proxy headers (Authentik, etc.)
             */
            proxyAuth?: boolean;

            /**
             * Session ID from cookie
             */
            sessionId?: string;
        }
    }
}

// This file must be a module
export { };

/**
 * Typed errors for Plex SSO / admin-token failures.
 * Callers must not treat these as "user has no library access".
 */
export class PlexAdminTokenInvalidError extends Error {
    readonly code = 'PLEX_ADMIN_TOKEN_INVALID' as const;

    constructor(message = 'Plex admin token is invalid or expired') {
        super(message);
        this.name = 'PlexAdminTokenInvalidError';
    }
}

export function isPlexAdminTokenInvalidError(error: unknown): error is PlexAdminTokenInvalidError {
    return error instanceof PlexAdminTokenInvalidError
        || (error instanceof Error && error.name === 'PlexAdminTokenInvalidError');
}

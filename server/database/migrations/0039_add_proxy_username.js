/**
 * Migration 0039: Fix proxy user password hashes
 * 
 * Replaces vulnerable PROXY_AUTH_PLACEHOLDER bcrypt hashes with an invalid
 * constant that bcrypt can never match. This prevents proxy-only users
 * from logging in with a guessable password.
 */

module.exports = {
    version: 39,
    name: 'fix_proxy_password_hashes',
    up(db) {
        // Fix existing proxy users: replace vulnerable PROXY_AUTH_PLACEHOLDER hashes
        // with an invalid constant that bcrypt can never match.
        // We identify proxy users by has_local_password = 0.
        db.exec(`
            UPDATE users 
            SET password = '$PROXY_NO_PASSWORD$'
            WHERE has_local_password = 0;
        `);
    }
};

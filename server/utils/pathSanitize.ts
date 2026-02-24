/**
 * Path Sanitization Utility
 * 
 * Prevents path traversal attacks by ensuring file paths stay within
 * their intended base directory. Use this whenever constructing file
 * paths from user input or external data (API responses, request params).
 */

import path from 'path';

/**
 * Sanitize a filename by removing path traversal characters.
 * Returns only the basename (no directory components).
 * 
 * @example
 * sanitizeFilename('../../etc/passwd')  // returns 'passwd'
 * sanitizeFilename('movie-12345.jpg')   // returns 'movie-12345.jpg'
 * sanitizeFilename('sub/dir/file.txt')  // returns 'file.txt'
 */
export function sanitizeFilename(filename: string): string {
    // Remove null bytes
    const cleaned = filename.replace(/\0/g, '');
    // Extract just the filename, stripping any directory components
    return path.basename(cleaned);
}

/**
 * Construct a safe file path within a base directory.
 * Ensures the resolved path stays within the base directory,
 * preventing path traversal attacks.
 * 
 * @param baseDir - The allowed base directory (must be absolute)
 * @param userPath - The user-provided path/filename to join
 * @returns The resolved, validated path
 * @throws Error if the resolved path escapes the base directory
 * 
 * @example
 * safePath('/app/cache', 'movie-123.jpg')        // '/app/cache/movie-123.jpg'
 * safePath('/app/cache', '../../etc/passwd')      // throws Error
 * safePath('/app/cache', 'subdir/file.txt')       // '/app/cache/subdir/file.txt' (if within base)
 */
export function safePath(baseDir: string, userPath: string): string {
    // Remove null bytes
    const cleaned = userPath.replace(/\0/g, '');

    // Use path.join first (safely concatenates, handles leading slashes)
    // then path.resolve to normalize (resolve ../ components)
    // NOTE: path.resolve(base, '/file') treats '/file' as absolute and ignores base!
    //       path.join(base, '/file') correctly concatenates to 'base/file'
    const joined = path.join(baseDir, cleaned);
    const resolved = path.resolve(joined);

    // Normalize both paths for comparison
    const normalizedBase = path.resolve(baseDir) + path.sep;
    const normalizedResolved = path.resolve(resolved);

    // Ensure the resolved path starts with the base directory
    if (!normalizedResolved.startsWith(normalizedBase) && normalizedResolved !== path.resolve(baseDir)) {
        throw new Error(`Path traversal detected: "${userPath}" escapes base directory`);
    }

    return resolved;
}

/**
 * Construct a safe file path, returning the sanitized basename only.
 * More restrictive than safePath — strips all directory components.
 * 
 * @param baseDir - The allowed base directory
 * @param filename - The user-provided filename
 * @returns The safe path using only the basename
 * 
 * @example
 * safeJoin('/app/cache', '../../etc/passwd')  // '/app/cache/passwd'
 * safeJoin('/app/cache', 'movie-123.jpg')     // '/app/cache/movie-123.jpg'
 */
export function safeJoin(baseDir: string, filename: string): string {
    return path.join(baseDir, sanitizeFilename(filename));
}

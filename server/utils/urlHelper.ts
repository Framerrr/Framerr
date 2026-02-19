/**
 * URL Helper Utility
 * Translates local network IPs to container-accessible hostnames
 */

/**
 * Translate local network IPs to host.local when running in Docker
 * This allows containers to access services running on the host machine
 * Requires container to be started with --add-host=host.local:host-gateway
 */
export function translateHostUrl(url: string): string {
    try {
        // Only translate URLs when running inside Docker
        // Check for common Docker environment indicators
        const isDocker = process.env.DOCKER ||
            process.env.DOCKER_HOST ||
            (process.platform === 'linux' && require('fs').existsSync('/.dockerenv'));

        if (!isDocker) {
            // Not in Docker - return URL as-is (no translation needed)
            return url.replace(/\/$/, '');
        }

        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;

        // Only translate loopback addresses — these genuinely can't reach the host from bridge mode.
        // Private LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x) are reachable from bridge,
        // so we leave them as-is.
        const isLoopback =
            hostname === 'localhost' ||
            hostname === '127.0.0.1';

        if (isLoopback) {
            parsedUrl.hostname = 'host.local';
            // Remove trailing slash if present (URL.toString() can add it)
            return parsedUrl.toString().replace(/\/$/, '');
        }

        // Remove trailing slash from original URL too for consistency
        return url.replace(/\/$/, '');
    } catch {
        // If URL parsing fails, return original
        return url;
    }
}

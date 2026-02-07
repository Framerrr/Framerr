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

        // Check if hostname is a local/private network IP
        const isLocalIP =
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.16.') ||
            hostname.startsWith('172.17.') ||
            hostname.startsWith('172.18.') ||
            hostname.startsWith('172.19.') ||
            hostname.startsWith('172.20.') ||
            hostname.startsWith('172.21.') ||
            hostname.startsWith('172.22.') ||
            hostname.startsWith('172.23.') ||
            hostname.startsWith('172.24.') ||
            hostname.startsWith('172.25.') ||
            hostname.startsWith('172.26.') ||
            hostname.startsWith('172.27.') ||
            hostname.startsWith('172.28.') ||
            hostname.startsWith('172.29.') ||
            hostname.startsWith('172.30.') ||
            hostname.startsWith('172.31.') ||
            hostname === 'localhost' ||
            hostname === '127.0.0.1';

        if (isLocalIP) {
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

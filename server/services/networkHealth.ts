/**
 * Network Health Detection
 * 
 * Utility for detecting network connectivity issues by monitoring
 * the default gateway. Used to distinguish "Framerr network issue"
 * from "service is actually down."
 * 
 * Usage:
 * - startNetworkHealthMonitor() on server startup
 * - isNetworkHealthy() before processing service failures
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import net from 'net';
import logger from '../utils/logger';

const execAsync = promisify(exec);

// ============================================================================
// State
// ============================================================================

let defaultGateway: string | null = null;
let lastGatewayCheck: number = 0;
let lastGatewayReachable: boolean = true;
const GATEWAY_CHECK_INTERVAL_MS = 10000; // 10 seconds
const GATEWAY_PING_TIMEOUT_MS = 2000; // 2 seconds

// ============================================================================
// Gateway Detection
// ============================================================================

/**
 * Auto-detect the default gateway from the OS routing table.
 * Works on Windows, Linux, and macOS.
 */
export async function detectDefaultGateway(): Promise<string | null> {
    try {
        const os = platform();
        let cmd: string;

        if (os === 'win32') {
            // Windows: Parse route print output
            cmd = 'route print 0.0.0.0';
        } else if (os === 'darwin') {
            // macOS: Use netstat
            cmd = "netstat -rn | grep 'default' | head -1 | awk '{print $2}'";
        } else {
            // Linux: Use ip route
            cmd = "ip route | grep 'default' | awk '{print $3}'";
        }

        const { stdout } = await execAsync(cmd, { timeout: 5000 });

        if (os === 'win32') {
            // Parse Windows route table output
            // Looking for line with 0.0.0.0 destination and extract gateway
            const lines = stdout.split('\n');
            for (const line of lines) {
                // Match pattern: 0.0.0.0 (spaces) 0.0.0.0 (spaces) gateway_ip
                const match = line.match(/0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)/);
                if (match) {
                    const gateway = match[1];
                    // Skip if gateway is 0.0.0.0 (means no route)
                    if (gateway !== '0.0.0.0') {
                        return gateway;
                    }
                }
            }
        } else {
            // Unix-like: stdout is the gateway IP directly
            const gateway = stdout.trim();
            if (gateway && /^\d+\.\d+\.\d+\.\d+$/.test(gateway)) {
                return gateway;
            }
        }

        return null;
    } catch (error) {
        logger.warn(`[NetworkHealth] Failed to detect gateway: error="${(error as Error).message}"`);
        return null;
    }
}

/**
 * Ping the gateway using TCP connection (platform-independent).
 * Uses a quick TCP connection attempt to port 80 or 443.
 * If those fail, falls back to ICMP ping.
 */
async function pingGateway(gateway: string): Promise<boolean> {
    // Try TCP connection first (works without elevated privileges)
    const tcpReachable = await tcpPing(gateway, 80, GATEWAY_PING_TIMEOUT_MS);
    if (tcpReachable) return true;

    // Try common router ports
    const port443 = await tcpPing(gateway, 443, GATEWAY_PING_TIMEOUT_MS);
    if (port443) return true;

    // Fall back to ICMP ping
    return await icmpPing(gateway);
}

/**
 * Attempt TCP connection to check reachability.
 */
function tcpPing(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;

        const cleanup = () => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
            }
        };

        socket.setTimeout(timeoutMs);

        socket.connect(port, host, () => {
            cleanup();
            resolve(true);
        });

        socket.on('error', () => {
            cleanup();
            resolve(false);
        });

        socket.on('timeout', () => {
            cleanup();
            resolve(false);
        });
    });
}

/**
 * ICMP ping fallback.
 */
async function icmpPing(host: string): Promise<boolean> {
    try {
        const os = platform();
        const cmd = os === 'win32'
            ? `ping -n 1 -w ${GATEWAY_PING_TIMEOUT_MS} ${host}`
            : `ping -c 1 -W ${Math.ceil(GATEWAY_PING_TIMEOUT_MS / 1000)} ${host}`;

        await execAsync(cmd, { timeout: GATEWAY_PING_TIMEOUT_MS + 1000 });
        return true;
    } catch {
        return false;
    }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize network health monitoring.
 * Detects gateway and starts periodic checks.
 */
export async function startNetworkHealthMonitor(): Promise<void> {
    defaultGateway = await detectDefaultGateway();

    if (defaultGateway) {
        logger.info(`[NetworkHealth] Detected gateway: ip=${defaultGateway}`);

        // Initial check
        lastGatewayReachable = await pingGateway(defaultGateway);
        lastGatewayCheck = Date.now();

        logger.info(`[NetworkHealth] Initial check: gateway=${defaultGateway} reachable=${lastGatewayReachable}`);
    } else {
        logger.warn('[NetworkHealth] Could not detect default gateway - network health checks disabled');
    }
}

/**
 * Check if network is healthy (gateway is reachable).
 * Returns true if:
 * - Gateway was reachable on last check
 * - Gateway could not be detected (assume healthy)
 */
export function isNetworkHealthy(): boolean {
    // If we couldn't detect a gateway, assume network is healthy
    if (!defaultGateway) return true;

    return lastGatewayReachable;
}

/**
 * Perform a gateway check if enough time has passed.
 * Called periodically by the service poller.
 */
export async function checkNetworkHealth(): Promise<boolean> {
    // If no gateway detected, assume healthy
    if (!defaultGateway) return true;

    const now = Date.now();

    // Only check if enough time has passed since last check
    if (now - lastGatewayCheck >= GATEWAY_CHECK_INTERVAL_MS) {
        const wasReachable = lastGatewayReachable;
        lastGatewayReachable = await pingGateway(defaultGateway);
        lastGatewayCheck = now;

        // Log state changes
        if (wasReachable !== lastGatewayReachable) {
            if (lastGatewayReachable) {
                logger.info(`[NetworkHealth] Gateway reachable: ip=${defaultGateway}`);
            } else {
                logger.warn(`[NetworkHealth] Gateway unreachable: ip=${defaultGateway}`);
            }
        }
    }

    return lastGatewayReachable;
}

/**
 * Get current gateway for debugging.
 */
export function getGatewayInfo(): { gateway: string | null; reachable: boolean; lastCheck: number } {
    return {
        gateway: defaultGateway,
        reachable: lastGatewayReachable,
        lastCheck: lastGatewayCheck,
    };
}

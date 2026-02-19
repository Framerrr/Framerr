/**
 * Config Redaction Utilities
 * 
 * Prevents sensitive fields (API keys, tokens, passwords) from being
 * sent in plaintext to the browser. Uses a sentinel value pattern:
 * - GET responses replace sensitive fields with "••••••••"
 * - PUT/POST merges sentinel values with existing DB values
 * 
 * Which fields are sensitive is determined by the plugin schema
 * (fields with sensitive: true are redacted).
 */

import { plugins } from '../../../integrations/registry';

/** Fixed-length sentinel that replaces real values in API responses */
export const REDACTED_SENTINEL = '••••••••';

/** Regex to detect any string composed entirely of bullet characters */
const BULLET_ONLY_REGEX = /^•+$/;

/**
 * Get the keys of all sensitive fields for a given integration type.
 */
export function getSensitiveFieldKeys(type: string): string[] {
    const plugin = plugins.find(p => p.id === type);
    if (!plugin?.configSchema?.fields) return [];
    return plugin.configSchema.fields
        .filter((f: { sensitive?: boolean }) => f.sensitive === true)
        .map((f: { key: string }) => f.key);
}

/**
 * Replace sensitive field values with the sentinel string.
 * Non-sensitive fields and empty/null values are left as-is.
 */
export function redactConfig(
    config: Record<string, unknown>,
    type: string
): Record<string, unknown> {
    const sensitiveFields = getSensitiveFieldKeys(type);
    if (sensitiveFields.length === 0) return config;

    const redacted = { ...config };
    for (const key of sensitiveFields) {
        if (redacted[key]) {
            redacted[key] = REDACTED_SENTINEL;
        }
    }
    return redacted;
}

/**
 * Merge incoming config with existing DB config, preserving real values
 * for any fields that still contain the sentinel (i.e., admin didn't change them).
 * 
 * Safety net: any value composed entirely of bullet characters (partial or full
 * sentinel) is treated as "keep existing" to prevent accidental corruption.
 */
export function mergeConfigWithExisting(
    incoming: Record<string, unknown>,
    existing: Record<string, unknown>,
    type: string
): Record<string, unknown> {
    const sensitiveFields = getSensitiveFieldKeys(type);
    if (sensitiveFields.length === 0) return incoming;

    const merged = { ...incoming };
    for (const key of sensitiveFields) {
        const value = merged[key];
        if (typeof value === 'string' && BULLET_ONLY_REGEX.test(value)) {
            merged[key] = existing[key]; // Keep the real DB value
        }
    }
    return merged;
}


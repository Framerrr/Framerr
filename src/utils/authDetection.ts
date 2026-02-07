/**
 * Generic iframe authentication detection utility
 * Detects when an iframe needs authentication without hardcoded URLs
 */

/**
 * Common authentication URL patterns
 */
const DEFAULT_AUTH_PATTERNS: string[] = [
    '/auth',
    '/login',
    '/signin',
    '/sign-in',
    '/oauth',
    '/saml',
    '/sso',
    '/authentication',
    '/authorize',
    '/session',
    '/identity',
];

/**
 * Detection sensitivity levels
 */
export type AuthDetectionSensitivity = 'conservative' | 'balanced' | 'aggressive';

/**
 * Auth detection result
 */
export interface AuthDetectionResult {
    needsAuth: boolean;
    confidence: number;
    reasons: string[];
    threshold: number;
}

/**
 * IFrame auth config from system config
 */
interface IframeAuthConfig {
    enabled?: boolean;
    sensitivity?: AuthDetectionSensitivity;
    customPatterns?: string[];
}

/**
 * System config shape for auth detection
 */
interface SystemConfigForAuth {
    iframeAuth?: IframeAuthConfig;
}

/**
 * Check if a URL matches common authentication patterns
 * @param url - URL to check
 * @returns True if URL likely requires authentication
 */
export const matchesAuthPattern = (url: string | null | undefined): boolean => {
    if (!url) return false;

    const lowerUrl = url.toLowerCase();
    return DEFAULT_AUTH_PATTERNS.some(pattern => lowerUrl.includes(pattern));
};

/**
 * Extract domain from URL
 * @param url - Full URL
 * @returns Domain or null if invalid
 */
export const extractDomain = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return null;
    }
};

/**
 * Check if iframe URL differs from expected URL domain
 * @param currentUrl - Current iframe URL
 * @param expectedUrl - Expected tab URL
 * @returns True if domains don't match
 */
export const hasDomainMismatch = (
    currentUrl: string | null | undefined,
    expectedUrl: string | null | undefined
): boolean => {
    const currentDomain = extractDomain(currentUrl);
    const expectedDomain = extractDomain(expectedUrl);

    if (!currentDomain || !expectedDomain) return false;

    return currentDomain !== expectedDomain;
};

/**
 * Check if URL matches user-configured auth patterns
 * @param url - URL to check
 * @param userPatterns - User-defined auth patterns
 * @returns True if matches user pattern
 */
export const matchesUserPattern = (
    url: string | null | undefined,
    userPatterns: string[] = []
): boolean => {
    if (!url || !userPatterns.length) return false;

    const lowerUrl = url.toLowerCase();
    return userPatterns.some(pattern =>
        lowerUrl.includes(pattern.toLowerCase())
    );
};

/**
 * Calculate confidence score that iframe needs authentication
 * @param iframeUrl - Current iframe URL
 * @param expectedUrl - Expected tab URL
 * @param userPatterns - User-defined auth patterns
 * @param sensitivity - Detection sensitivity
 * @returns Detection result with confidence and reasons
 */
export const detectAuthNeed = (
    iframeUrl: string | null | undefined,
    expectedUrl: string | null | undefined,
    userPatterns: string[] = [],
    sensitivity: AuthDetectionSensitivity = 'balanced'
): AuthDetectionResult => {
    let confidence = 0;
    const reasons: string[] = [];

    // Signal 1: User-configured auth URL (highest confidence)
    if (matchesUserPattern(iframeUrl, userPatterns)) {
        confidence += 5;
        reasons.push('Matches user-configured auth URL');
    }

    // Signal 2: Common auth URL pattern
    if (matchesAuthPattern(iframeUrl)) {
        confidence += 3;
        reasons.push('Matches common auth URL pattern');
    }

    // Signal 3: Domain mismatch (iframe redirected to different domain)
    if (hasDomainMismatch(iframeUrl, expectedUrl)) {
        confidence += 2;
        reasons.push('Domain mismatch detected');
    }

    // Signal 4: HTTPS downgrade (suspicious)
    if (expectedUrl?.startsWith('https:') && iframeUrl?.startsWith('http:')) {
        confidence += 1;
        reasons.push('HTTPS downgrade detected');
    }

    // Determine threshold based on sensitivity
    const thresholds: Record<AuthDetectionSensitivity, number> = {
        conservative: 5, // Only user-configured or very high confidence
        balanced: 3,     // Pattern match or multiple signals
        aggressive: 2,   // Any significant signal
    };

    const threshold = thresholds[sensitivity] || thresholds.balanced;
    const needsAuth = confidence >= threshold;

    return {
        needsAuth,
        confidence,
        reasons,
        threshold,
    };
};

/**
 * Get detection sensitivity from config
 * @param config - System configuration
 * @returns Sensitivity level
 */
export const getSensitivity = (
    config: SystemConfigForAuth | null | undefined
): AuthDetectionSensitivity => {
    return config?.iframeAuth?.sensitivity || 'balanced';
};

/**
 * Get user-configured auth patterns from config
 * @param config - System configuration
 * @returns User auth patterns
 */
export const getUserAuthPatterns = (
    config: SystemConfigForAuth | null | undefined
): string[] => {
    return config?.iframeAuth?.customPatterns || [];
};

/**
 * Check if iframe auth detection is enabled
 * @param config - System configuration
 * @returns True if enabled
 */
export const isAuthDetectionEnabled = (
    config: SystemConfigForAuth | null | undefined
): boolean => {
    return config?.iframeAuth?.enabled !== false; // Enabled by default
};

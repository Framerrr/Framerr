/**
 * mediaDeepLinks — Unit tests
 *
 * Focused verification for the Emby serverId deep-link fix (TASK-20260310-001).
 * Also covers Plex and Jellyfin for completeness.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getPlexDeepLink,
    getJellyfinDeepLink,
    getEmbyDeepLink,
    getMediaDeepLink,
    getMediaServerDisplayName,
    isIosClient,
    getPlexNativeLink,
    openMediaInApp,
    openPlexNativeOrFallback,
    PLEX_IOS_FALLBACK_DELAY_MS,
} from '../mediaDeepLinks';

// ============================================================================
// getPlexDeepLink
// ============================================================================

describe('getPlexDeepLink', () => {
    it('generates a Plex Web URL with encoded ratingKey', () => {
        const url = getPlexDeepLink('12345', 'abc-machine');
        expect(url).toBe(
            'https://app.plex.tv/desktop#!/server/abc-machine/details?key=%2Flibrary%2Fmetadata%2F12345'
        );
    });
});

// ============================================================================
// getJellyfinDeepLink
// ============================================================================

describe('getJellyfinDeepLink', () => {
    it('generates a Jellyfin Web URL', () => {
        const url = getJellyfinDeepLink('item-99', 'http://192.168.1.50:8096');
        expect(url).toBe('http://192.168.1.50:8096/web/index.html#!/details?id=item-99');
    });

    it('trims trailing slash from serverUrl', () => {
        const url = getJellyfinDeepLink('item-99', 'http://192.168.1.50:8096/');
        expect(url).toBe('http://192.168.1.50:8096/web/index.html#!/details?id=item-99');
    });
});

// ============================================================================
// getEmbyDeepLink — PRIMARY VERIFICATION TARGET
// ============================================================================

describe('getEmbyDeepLink', () => {
    const serverUrl = 'http://192.168.1.100:8096';
    const itemId = 'emby-item-42';

    it('generates an Emby URL without serverId when not provided', () => {
        const url = getEmbyDeepLink(itemId, serverUrl);
        expect(url).toBe(`${serverUrl}/web/index.html#!/item?id=${itemId}`);
        expect(url).not.toContain('serverId');
    });

    it('appends &serverId= when serverId is provided', () => {
        const url = getEmbyDeepLink(itemId, serverUrl, 'srv-abc-123');
        expect(url).toBe(`${serverUrl}/web/index.html#!/item?id=${itemId}&serverId=srv-abc-123`);
        expect(url).toContain('&serverId=srv-abc-123');
    });

    it('does not append serverId when it is undefined', () => {
        const url = getEmbyDeepLink(itemId, serverUrl, undefined);
        expect(url).not.toContain('serverId');
    });

    it('does not append serverId when it is empty string', () => {
        const url = getEmbyDeepLink(itemId, serverUrl, '');
        expect(url).not.toContain('serverId');
    });

    it('trims trailing slash from serverUrl', () => {
        const url = getEmbyDeepLink(itemId, `${serverUrl}/`, 'srv-x');
        expect(url.startsWith(`${serverUrl}/web/`)).toBe(true);
        expect(url).not.toContain('8096//web');
    });
});

// ============================================================================
// getMediaDeepLink (unified dispatcher)
// ============================================================================

describe('getMediaDeepLink', () => {
    it('dispatches plex with machineId', () => {
        const url = getMediaDeepLink('plex', '100', { machineId: 'mc-1' });
        expect(url).toContain('server/mc-1/details');
    });

    it('returns null for plex without machineId', () => {
        expect(getMediaDeepLink('plex', '100', {})).toBeNull();
    });

    it('dispatches jellyfin with serverUrl', () => {
        const url = getMediaDeepLink('jellyfin', 'jf-1', { serverUrl: 'http://jf:8096' });
        expect(url).toContain('http://jf:8096/web/');
    });

    it('returns null for jellyfin without serverUrl', () => {
        expect(getMediaDeepLink('jellyfin', 'jf-1', {})).toBeNull();
    });

    it('dispatches emby with serverUrl and passes serverId through', () => {
        const url = getMediaDeepLink('emby', 'em-1', {
            serverUrl: 'http://emby:8096',
            serverId: 'srv-emby-id',
        });
        expect(url).toContain('&serverId=srv-emby-id');
    });

    it('dispatches emby without serverId (still generates URL)', () => {
        const url = getMediaDeepLink('emby', 'em-1', {
            serverUrl: 'http://emby:8096',
        });
        expect(url).not.toBeNull();
        expect(url).not.toContain('serverId');
    });

    it('returns null for emby without serverUrl', () => {
        expect(getMediaDeepLink('emby', 'em-1', {})).toBeNull();
    });

    it('returns null for empty itemId', () => {
        expect(getMediaDeepLink('plex', '', { machineId: 'mc-1' })).toBeNull();
    });
});

// ============================================================================
// getMediaServerDisplayName
// ============================================================================

describe('getMediaServerDisplayName', () => {
    it('returns correct display names', () => {
        expect(getMediaServerDisplayName('plex')).toBe('Plex');
        expect(getMediaServerDisplayName('jellyfin')).toBe('Jellyfin');
        expect(getMediaServerDisplayName('emby')).toBe('Emby');
    });
});

// ============================================================================
// isIosClient
// ============================================================================

function mockNavigator(overrides: {
    userAgent?: string;
    platform?: string;
    maxTouchPoints?: number;
}): void {
    Object.defineProperty(navigator, 'userAgent', {
        value: overrides.userAgent ?? navigator.userAgent,
        configurable: true,
    });
    Object.defineProperty(navigator, 'platform', {
        value: overrides.platform ?? navigator.platform,
        configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
        value: overrides.maxTouchPoints ?? navigator.maxTouchPoints,
        configurable: true,
    });
}

describe('isIosClient', () => {
    it('returns true for iPhone UA', () => {
        mockNavigator({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
        expect(isIosClient()).toBe(true);
    });

    it('returns true for iPod UA', () => {
        mockNavigator({ userAgent: 'Mozilla/5.0 (iPod; CPU iPhone OS 12_0 like Mac OS X)' });
        expect(isIosClient()).toBe(true);
    });

    it('returns true for iPad UA (iOS ≤ 12)', () => {
        mockNavigator({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X)' });
        expect(isIosClient()).toBe(true);
    });

    it('returns true for iPad iOS 13+ (MacIntel + maxTouchPoints > 1)', () => {
        mockNavigator({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            platform: 'MacIntel',
            maxTouchPoints: 5,
        });
        expect(isIosClient()).toBe(true);
    });

    it('returns false for desktop Chrome', () => {
        mockNavigator({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
            platform: 'Win32',
            maxTouchPoints: 0,
        });
        expect(isIosClient()).toBe(false);
    });

    it('returns false for desktop Safari', () => {
        mockNavigator({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
            platform: 'MacIntel',
            maxTouchPoints: 0,
        });
        expect(isIosClient()).toBe(false);
    });

    it('returns false for Android', () => {
        mockNavigator({
            userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
            platform: 'Linux armv8l',
            maxTouchPoints: 5,
        });
        expect(isIosClient()).toBe(false);
    });
});

// ============================================================================
// getPlexNativeLink
// ============================================================================

describe('getPlexNativeLink', () => {
    it('returns plex://preplay URL with encoded metadataKey and server param', () => {
        expect(getPlexNativeLink('12345', 'abc-machine')).toBe(
            'plex://preplay/?metadataKey=%2Flibrary%2Fmetadata%2F12345&server=abc-machine'
        );
    });

    it('encodes forward slashes in the path component', () => {
        const url = getPlexNativeLink('999', 'srv');
        expect(url).toContain('%2Flibrary%2Fmetadata%2F999');
        expect(url).not.toContain('/library/metadata/999');
    });
});

// ============================================================================
// openMediaInApp – iOS Plex
// ============================================================================

describe('openMediaInApp – iOS Plex', () => {
    const originalLocation = window.location;

    beforeEach(() => {
        vi.useFakeTimers();
        mockNavigator({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
            platform: 'iPhone',
            maxTouchPoints: 5,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            configurable: true,
            writable: true,
        });
        Object.defineProperty(document, 'hidden', {
            value: false,
            configurable: true,
        });
    });

    it('sets window.location.href to plex:// URL when iOS + plex + machineId present', () => {
        let capturedHref = '';
        Object.defineProperty(window, 'location', {
            value: {
                get href() { return capturedHref; },
                set href(v: string) { capturedHref = v; },
            },
            configurable: true,
        });
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        openMediaInApp('plex', '12345', { machineId: 'abc-machine' });

        expect(capturedHref).toBe(
            'plex://preplay/?metadataKey=%2Flibrary%2Fmetadata%2F12345&server=abc-machine'
        );
        expect(openSpy).not.toHaveBeenCalled();
        openSpy.mockRestore();
    });

    it('does NOT call window.open immediately on iOS (defers to timer)', () => {
        Object.defineProperty(window, 'location', {
            value: { href: '' },
            configurable: true,
            writable: true,
        });
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        openMediaInApp('plex', '12345', { machineId: 'abc-machine' });

        expect(openSpy).not.toHaveBeenCalled();
        openSpy.mockRestore();
    });

    it('falls back to window.open with web URL after timeout when page stays visible', () => {
        Object.defineProperty(window, 'location', {
            value: { href: '' },
            configurable: true,
            writable: true,
        });
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        openMediaInApp('plex', '12345', { machineId: 'abc-machine' });
        vi.advanceTimersByTime(PLEX_IOS_FALLBACK_DELAY_MS);

        expect(openSpy).toHaveBeenCalledWith(
            'https://app.plex.tv/desktop#!/server/abc-machine/details?key=%2Flibrary%2Fmetadata%2F12345',
            '_blank'
        );
        openSpy.mockRestore();
    });

    it('desktop Plex calls window.open(webUrl) unchanged', () => {
        vi.useRealTimers();
        mockNavigator({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            platform: 'Win32',
            maxTouchPoints: 0,
        });
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        openMediaInApp('plex', '12345', { machineId: 'abc-machine' });

        expect(openSpy).toHaveBeenCalledWith(
            'https://app.plex.tv/desktop#!/server/abc-machine/details?key=%2Flibrary%2Fmetadata%2F12345',
            '_blank'
        );
        openSpy.mockRestore();
    });
});

// ============================================================================
// openPlexNativeOrFallback – visibilitychange cancels fallback
// ============================================================================

describe('openPlexNativeOrFallback – visibilitychange cancels fallback', () => {
    const webUrl = 'https://app.plex.tv/desktop#!/server/abc/details?key=%2Ftest';

    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(window, 'location', {
            value: { href: '' },
            configurable: true,
            writable: true,
        });
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    });

    it('does NOT call window.open when the page becomes hidden before PLEX_IOS_FALLBACK_DELAY_MS elapses', () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        openPlexNativeOrFallback('12345', 'abc-machine', webUrl);
        vi.advanceTimersByTime(PLEX_IOS_FALLBACK_DELAY_MS / 2);

        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        vi.advanceTimersByTime(PLEX_IOS_FALLBACK_DELAY_MS);

        expect(openSpy).not.toHaveBeenCalled();
        openSpy.mockRestore();
    });

    it('removes the visibilitychange listener after resolving, so a later hide event does not double-fire cleanup', () => {
        const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        openPlexNativeOrFallback('12345', 'abc-machine', webUrl);
        vi.advanceTimersByTime(PLEX_IOS_FALLBACK_DELAY_MS / 2);

        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        expect(removeListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

        removeListenerSpy.mockRestore();
        openSpy.mockRestore();
    });
});

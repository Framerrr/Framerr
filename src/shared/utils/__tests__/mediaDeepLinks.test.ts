/**
 * mediaDeepLinks — Unit tests
 *
 * Focused verification for the Emby serverId deep-link fix (TASK-20260310-001).
 * Also covers Plex and Jellyfin for completeness.
 */
import { describe, it, expect } from 'vitest';
import {
    getPlexDeepLink,
    getJellyfinDeepLink,
    getEmbyDeepLink,
    getMediaDeepLink,
    getMediaServerDisplayName,
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

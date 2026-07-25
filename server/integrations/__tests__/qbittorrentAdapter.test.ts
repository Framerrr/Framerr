/**
 * qBittorrent Adapter — session cookie parsing (legacy SID + 5.2+ QBT_SID_*)
 */

import { describe, it, expect } from 'vitest';
import { parseQbittorrentSessionCookie } from '../qbittorrent/adapter';

describe('parseQbittorrentSessionCookie', () => {
    it('parses legacy SID cookie', () => {
        expect(parseQbittorrentSessionCookie(['SID=abc123; path=/'])).toEqual({
            name: 'SID',
            value: 'abc123',
        });
    });

    it('parses qBittorrent 5.2+ QBT_SID_<port> cookie', () => {
        expect(
            parseQbittorrentSessionCookie(['QBT_SID_8080=xyz789; HttpOnly; Path=/; SameSite=Strict'])
        ).toEqual({
            name: 'QBT_SID_8080',
            value: 'xyz789',
        });
    });

    it('prefers QBT_SID_* when both legacy and 5.2 cookies are present', () => {
        expect(
            parseQbittorrentSessionCookie([
                'SID=old; Path=/',
                'QBT_SID_8080=new; Path=/',
            ])
        ).toEqual({
            name: 'QBT_SID_8080',
            value: 'new',
        });
    });

    it('accepts a single Set-Cookie string', () => {
        expect(parseQbittorrentSessionCookie('SID=solo; Path=/')).toEqual({
            name: 'SID',
            value: 'solo',
        });
    });

    it('returns null when no session cookie is present', () => {
        expect(parseQbittorrentSessionCookie(['other=1; Path=/'])).toBeNull();
        expect(parseQbittorrentSessionCookie(undefined)).toBeNull();
        expect(parseQbittorrentSessionCookie([])).toBeNull();
    });
});

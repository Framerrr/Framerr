/**
 * Active dashboard hash parsing and resolution order (multi-dashboard Step 20 / 39)
 */
import { describe, it, expect } from 'vitest';
import {
    isUnresolvedDashboardHash,
    parseDashboardIdFromHash,
    resolveActiveDashboardId,
} from '../ActiveDashboardContext';

describe('parseDashboardIdFromHash', () => {
    it('returns id from #dashboard/{id}', () => {
        expect(parseDashboardIdFromHash('#dashboard/abc-123')).toBe('abc-123');
    });

    it('returns null for bare #dashboard', () => {
        expect(parseDashboardIdFromHash('#dashboard')).toBeNull();
        expect(parseDashboardIdFromHash('#dashboard/')).toBeNull();
    });

    it('returns null for non-dashboard hashes', () => {
        expect(parseDashboardIdFromHash('#settings')).toBeNull();
    });
});

describe('isUnresolvedDashboardHash', () => {
    it('treats empty and bare dashboard routes as unresolved', () => {
        expect(isUnresolvedDashboardHash('')).toBe(true);
        expect(isUnresolvedDashboardHash('#dashboard')).toBe(true);
        expect(isUnresolvedDashboardHash('dashboard/')).toBe(true);
        expect(isUnresolvedDashboardHash('dashboard?x=1')).toBe(true);
    });

    it('treats concrete dashboard ids as resolved', () => {
        expect(isUnresolvedDashboardHash('#dashboard/abc')).toBe(false);
        expect(isUnresolvedDashboardHash('settings')).toBe(false);
    });
});

describe('resolveActiveDashboardId', () => {
    const dashboards = [{ id: 'a' }, { id: 'b' }];
    const base = {
        dashboards,
        homeDashboardId: 'a',
        rememberLast: false,
        storedId: null as string | null,
        deepLinkId: null as string | null,
        sessionId: null as string | null,
    };

    it('prefers deep link when valid', () => {
        expect(
            resolveActiveDashboardId({ ...base, deepLinkId: 'b' })
        ).toBe('b');
    });

    it('uses remember-last when enabled and id valid', () => {
        expect(
            resolveActiveDashboardId({
                ...base,
                rememberLast: true,
                storedId: 'b',
            })
        ).toBe('b');
    });

    it('uses session id when remember-last is off', () => {
        expect(
            resolveActiveDashboardId({
                ...base,
                rememberLast: false,
                sessionId: 'b',
            })
        ).toBe('b');
    });

    it('prefers remember-last over session', () => {
        expect(
            resolveActiveDashboardId({
                ...base,
                rememberLast: true,
                storedId: 'b',
                sessionId: 'a',
                // home is a; storage b wins over session
            })
        ).toBe('b');
    });

    it('falls back to home when no deep link, storage, or session', () => {
        expect(resolveActiveDashboardId(base)).toBe('a');
    });

    it('falls back to first dashboard when home invalid', () => {
        expect(
            resolveActiveDashboardId({ ...base, homeDashboardId: 'missing' })
        ).toBe('a');
    });

    it('returns null when no dashboards', () => {
        expect(
            resolveActiveDashboardId({
                ...base,
                dashboards: [],
                homeDashboardId: 'a',
            })
        ).toBeNull();
    });
});

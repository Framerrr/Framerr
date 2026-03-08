/**
 * Characterization Tests for Auth Middleware (BL-AUTH-1)
 *
 * Phase 1: Lock CURRENT behavior BEFORE the requireAuth error shape fix.
 * Phase 2: Update test 1 to match fixed shape AFTER the code change.
 *
 * Task: TASK-20260307-001 (S-B1-03: Normalize Auth Error Payloads)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the permissions utility used by requireAdmin
const mockHasPermission = vi.fn();
vi.mock('../../utils/permissions', () => ({
    hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Import AFTER mocks
import { requireAuth, requireAdmin } from '../auth';

// Helper to create mock Express req/res/next
function createMockReq(user?: { id: string; username: string; group: string }): Request {
    const req = {} as Request;
    if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).user = user;
    }
    return req;
}

function createMockRes() {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    return res;
}

function createMockNext(): NextFunction {
    return vi.fn() as unknown as NextFunction;
}

// ============================================================================
// BL-AUTH-1: Auth Middleware Error Shape Characterization
// ============================================================================

describe('BL-AUTH-1: requireAuth middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Phase 2 test 1: Locks FIXED flat string shape (was nested object)
    it('returns 401 with flat error shape when no user attached', () => {
        const req = createMockReq(); // no user
        const res = createMockRes();
        const next = createMockNext();

        requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        // Phase 2: Fixed flat shape (matches requireAdmin and all route-level errors)
        expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
        // Failure branch must NOT call next()
        expect(next).not.toHaveBeenCalled();
    });

    it('calls next() when user is attached (happy path)', () => {
        const req = createMockReq({ id: 'user-1', username: 'testuser', group: 'user' });
        const res = createMockRes();
        const next = createMockNext();

        requireAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        // Success branch must NOT send error response
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe('BL-AUTH-1: requireAdmin middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 with flat error when no user attached', async () => {
        const req = createMockReq(); // no user
        const res = createMockRes();
        const next = createMockNext();

        await requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
        // Failure branch must NOT call next()
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 with flat error for non-admin user without wildcard permission', async () => {
        const req = createMockReq({ id: 'user-1', username: 'testuser', group: 'user' });
        const res = createMockRes();
        const next = createMockNext();

        // Non-admin, no wildcard
        mockHasPermission.mockResolvedValue(false);

        await requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
        // Failure branch must NOT call next()
        expect(next).not.toHaveBeenCalled();
    });

    it('calls next() for admin group user (happy path)', async () => {
        const req = createMockReq({ id: 'admin-1', username: 'admin', group: 'admin' });
        const res = createMockRes();
        const next = createMockNext();

        await requireAdmin(req, res, next);

        expect(next).toHaveBeenCalled();
        // Success branch must NOT send error response
        expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() for non-admin user with wildcard permission (happy path)', async () => {
        const req = createMockReq({ id: 'user-2', username: 'poweruser', group: 'user' });
        const res = createMockRes();
        const next = createMockNext();

        // Has wildcard permission
        mockHasPermission.mockResolvedValue(true);

        await requireAdmin(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
});

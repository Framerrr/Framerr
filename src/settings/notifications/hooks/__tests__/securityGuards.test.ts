/**
 * Security Guards — Characterization Tests
 *
 * TASK-20260303-002 / REMEDIATION-2026-P2 / S-X3-01
 *
 * Tests the security guard logic extracted from server routes:
 *   BL-NOTIFY-1 — Self-targeted notification (no userId) succeeds
 *   BL-NOTIFY-2 — Admin cross-user targeting succeeds
 *   BL-NOTIFY-3 — Non-admin cross-user targeting returns 403
 *   BL-SSE-1    — Matching userId passes ownership check
 *   BL-SSE-2    — Mismatched userId fails ownership check
 *   BL-SSE-3    — Unknown connectionId fails ownership check
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Notification Targeting Guard Logic
// Mirrors the logic at server/routes/notifications.ts:107-119
// ============================================================================

interface NotificationTargetResult {
    allowed: boolean;
    targetUserId: string;
    status?: number;
    error?: string;
}

function evaluateNotificationTarget(
    requesterId: string,
    requesterGroup: string,
    bodyUserId?: string
): NotificationTargetResult {
    let targetUserId = requesterId;

    if (bodyUserId && bodyUserId !== requesterId) {
        if (requesterGroup !== 'admin') {
            return {
                allowed: false,
                targetUserId: requesterId,
                status: 403,
                error: 'Only administrators can create notifications for other users'
            };
        }
        targetUserId = bodyUserId;
    }

    return { allowed: true, targetUserId };
}

// ============================================================================
// SSE Connection Ownership Guard Logic
// Mirrors verifyConnectionOwnership at server/routes/realtime.ts:28-38
// ============================================================================

interface MockConnection {
    userId: string;
}

function evaluateConnectionOwnership(
    connections: Map<string, MockConnection>,
    connectionId: string,
    userId: string
): { allowed: boolean; status?: number; error?: string } {
    const connection = connections.get(connectionId);
    if (!connection || connection.userId !== userId) {
        return {
            allowed: false,
            status: 403,
            error: 'Connection does not belong to the authenticated user'
        };
    }
    return { allowed: true };
}

// ============================================================================
// BL-NOTIFY-1: Self-targeted notification
// ============================================================================

describe('BL-NOTIFY-1: Self-targeted notification', () => {
    it('allows notification without userId (targets self)', () => {
        const result = evaluateNotificationTarget('user-1', 'user');
        expect(result.allowed).toBe(true);
        expect(result.targetUserId).toBe('user-1');
    });

    it('allows notification with own userId', () => {
        const result = evaluateNotificationTarget('user-1', 'user', 'user-1');
        expect(result.allowed).toBe(true);
        expect(result.targetUserId).toBe('user-1');
    });
});

// ============================================================================
// BL-NOTIFY-2: Admin cross-user targeting
// ============================================================================

describe('BL-NOTIFY-2: Admin cross-user targeting', () => {
    it('allows admin to target another user', () => {
        const result = evaluateNotificationTarget('admin-1', 'admin', 'user-2');
        expect(result.allowed).toBe(true);
        expect(result.targetUserId).toBe('user-2');
    });
});

// ============================================================================
// BL-NOTIFY-3: Non-admin cross-user targeting blocked
// ============================================================================

describe('BL-NOTIFY-3: Non-admin cross-user targeting', () => {
    it('blocks non-admin from targeting another user with 403', () => {
        const result = evaluateNotificationTarget('user-1', 'user', 'user-2');
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(403);
        expect(result.error).toContain('administrators');
    });
});

// ============================================================================
// BL-SSE-1: Matching userId passes ownership
// ============================================================================

describe('BL-SSE-1: Matching ownership', () => {
    it('allows operation when connection userId matches authenticated user', () => {
        const connections = new Map<string, MockConnection>();
        connections.set('conn-1', { userId: 'user-1' });

        const result = evaluateConnectionOwnership(connections, 'conn-1', 'user-1');
        expect(result.allowed).toBe(true);
    });

    it('allows multi-tab: different connections for same user', () => {
        const connections = new Map<string, MockConnection>();
        connections.set('conn-tab1', { userId: 'user-1' });
        connections.set('conn-tab2', { userId: 'user-1' });

        // Both tabs pass ownership
        expect(evaluateConnectionOwnership(connections, 'conn-tab1', 'user-1').allowed).toBe(true);
        expect(evaluateConnectionOwnership(connections, 'conn-tab2', 'user-1').allowed).toBe(true);
    });
});

// ============================================================================
// BL-SSE-2: Mismatched userId fails ownership
// ============================================================================

describe('BL-SSE-2: Mismatched ownership', () => {
    it('blocks operation when connection belongs to different user', () => {
        const connections = new Map<string, MockConnection>();
        connections.set('conn-1', { userId: 'user-1' });

        const result = evaluateConnectionOwnership(connections, 'conn-1', 'user-2');
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(403);
        expect(result.error).toContain('does not belong');
    });
});

// ============================================================================
// BL-SSE-3: Unknown connectionId fails ownership
// ============================================================================

describe('BL-SSE-3: Unknown connection', () => {
    it('blocks operation for non-existent connectionId', () => {
        const connections = new Map<string, MockConnection>();
        connections.set('conn-1', { userId: 'user-1' });

        const result = evaluateConnectionOwnership(connections, 'conn-nonexistent', 'user-1');
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(403);
    });
});

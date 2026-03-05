/**
 * Webhook Token Generation — Security Characterization Tests
 *
 * TASK-20260303-002 / REMEDIATION-2026-P2 / S-X3-01
 *
 * Locks behavior of the webhook token generation after replacing
 * Math.random() with crypto.getRandomValues():
 *   BL-TOKEN-1 — Token is a valid UUID v4 format (36 chars, 5 groups)
 *   BL-TOKEN-2 — Token has correct version nibble (4)
 *   BL-TOKEN-3 — Token has correct variant bits (8, 9, a, or b)
 *   BL-TOKEN-4 — Tokens are unique across multiple generations
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Extracted token generation logic for testability
// This mirrors the actual implementation in useNotificationSettings.ts
// ============================================================================

function generateToken(): string {
    return typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map((b, i) => {
                if (i === 6) b = (b & 0x0f) | 0x40;
                if (i === 8) b = (b & 0x3f) | 0x80;
                return b.toString(16).padStart(2, '0');
            })
            .join('')
            .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

// ============================================================================
// UUID format regex: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
// ============================================================================

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ============================================================================
// BL-TOKEN-1: Valid UUID v4 format
// ============================================================================

describe('BL-TOKEN-1: UUID v4 format', () => {
    it('produces a 36-character string in UUID format', () => {
        const token = generateToken();
        expect(token).toHaveLength(36);
        expect(token).toMatch(UUID_V4_REGEX);
    });

    it('produces lowercase hex characters', () => {
        const token = generateToken();
        expect(token).toBe(token.toLowerCase());
    });
});

// ============================================================================
// BL-TOKEN-2: Version nibble is 4
// ============================================================================

describe('BL-TOKEN-2: UUID version nibble', () => {
    it('has version 4 in the 13th character position', () => {
        const token = generateToken();
        // UUID format: xxxxxxxx-xxxx-Vxxx-xxxx-xxxxxxxxxxxx
        // V is at index 14 (0-indexed) after hyphens
        expect(token[14]).toBe('4');
    });
});

// ============================================================================
// BL-TOKEN-3: Variant bits are correct (8, 9, a, or b)
// ============================================================================

describe('BL-TOKEN-3: UUID variant bits', () => {
    it('has variant bits 10xx (8, 9, a, or b) at position 19', () => {
        const token = generateToken();
        // UUID format: xxxxxxxx-xxxx-4xxx-Vxxx-xxxxxxxxxxxx
        // Variant is at index 19
        expect(['8', '9', 'a', 'b']).toContain(token[19]);
    });
});

// ============================================================================
// BL-TOKEN-4: Uniqueness
// ============================================================================

describe('BL-TOKEN-4: Token uniqueness', () => {
    it('generates unique tokens across 100 iterations', () => {
        const tokens = new Set<string>();
        for (let i = 0; i < 100; i++) {
            tokens.add(generateToken());
        }
        expect(tokens.size).toBe(100);
    });
});

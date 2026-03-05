/**
 * Webhook Handler Integrity — Characterization Tests
 *
 * TASK-20260304-005 / REMEDIATION-2026-P2 / S-X3-03
 *
 * Locks behavior of the webhook pipeline after removing legacy
 * compatibility routers:
 *   BL-WEBHOOK-1 — processWebhookNotification is importable from _shared.ts
 *   BL-WEBHOOK-2 — OVERSEERR_EVENT_MAP exports correct values from types.ts
 *   BL-WEBHOOK-3 — Plugin webhook configs export valid event definitions and handlers
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// BL-WEBHOOK-1: processWebhookNotification accessibility
// The plugin handlers in server/integrations/*/webhook.ts depend on this export.
// ============================================================================

describe('BL-WEBHOOK-1: processWebhookNotification export', () => {
    it('exports processWebhookNotification as a function from _shared', async () => {
        const mod = await import('../_shared');
        expect(typeof mod.processWebhookNotification).toBe('function');
    });
});

// ============================================================================
// BL-WEBHOOK-2: OVERSEERR_EVENT_MAP correctness
// test.ts depends on this export for simulating webhook events.
// ============================================================================

describe('BL-WEBHOOK-2: OVERSEERR_EVENT_MAP export', () => {
    it('maps media.pending to requestPending', async () => {
        const { OVERSEERR_EVENT_MAP } = await import('../types');
        expect(OVERSEERR_EVENT_MAP['media.pending']).toBe('requestPending');
    });

    it('maps test to test', async () => {
        const { OVERSEERR_EVENT_MAP } = await import('../types');
        expect(OVERSEERR_EVENT_MAP['test']).toBe('test');
    });

    it('maps media.available to requestAvailable', async () => {
        const { OVERSEERR_EVENT_MAP } = await import('../types');
        expect(OVERSEERR_EVENT_MAP['media.available']).toBe('requestAvailable');
    });
});

// ============================================================================
// BL-WEBHOOK-3: Plugin webhook handler configs
// The unified route handler depends on these plugins exporting valid configs.
// ============================================================================

describe('BL-WEBHOOK-3: Plugin webhook handler configs', () => {
    it('sonarr webhook exports events and handle function', async () => {
        const { webhook } = await import('../../../integrations/sonarr/webhook');
        expect(webhook.events.length).toBeGreaterThan(0);
        expect(typeof webhook.handle).toBe('function');
        expect(typeof webhook.buildExternalUrl).toBe('function');
    });

    it('radarr webhook exports events and handle function', async () => {
        const { webhook } = await import('../../../integrations/radarr/webhook');
        expect(webhook.events.length).toBeGreaterThan(0);
        expect(typeof webhook.handle).toBe('function');
        expect(typeof webhook.buildExternalUrl).toBe('function');
    });

    it('overseerr webhook exports events and handle function', async () => {
        const { webhook } = await import('../../../integrations/overseerr/webhook');
        expect(webhook.events.length).toBeGreaterThan(0);
        expect(typeof webhook.handle).toBe('function');
        expect(typeof webhook.buildExternalUrl).toBe('function');
    });
});

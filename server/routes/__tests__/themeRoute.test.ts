/**
 * Characterization Tests for Theme Route (BL-1 through BL-6)
 *
 * These tests lock current behavior BEFORE code changes per the Behavior Lock mandate.
 * After implementation, the tests will be updated to reflect the new validation rules.
 *
 * Task: TASK-20260303-003 (S-X5-01: Unify Theme Persistence Contract)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';

// ============================================================================
// Mocks
// ============================================================================

const mockGetUserConfig = vi.fn();
const mockUpdateUserConfig = vi.fn();
vi.mock('../../db/userConfig', () => ({
    getUserConfig: (...args: unknown[]) => mockGetUserConfig(...args),
    updateUserConfig: (...args: unknown[]) => mockUpdateUserConfig(...args),
}));

const mockGetSystemConfig = vi.fn();
const mockUpdateSystemConfig = vi.fn();
vi.mock('../../db/systemConfig', () => ({
    getSystemConfig: (...args: unknown[]) => mockGetSystemConfig(...args),
    updateSystemConfig: (...args: unknown[]) => mockUpdateSystemConfig(...args),
}));

const mockBroadcastToUser = vi.fn();
vi.mock('../../services/sseStreamService', () => ({
    broadcastToUser: (...args: unknown[]) => mockBroadcastToUser(...args),
}));

vi.mock('../../utils/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../middleware/auth', () => ({
    requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ============================================================================
// App Setup
// ============================================================================

import themeRouter from '../theme';

function createTestApp(userOverrides: Partial<{ id: string; username: string; group: 'admin' | 'user' | 'guest' }> = {}) {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: () => void) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).user = {
            id: 'user-1',
            username: 'testadmin',
            group: 'admin',
            isAdmin: true,
            ...userOverrides,
        };
        next();
    });
    app.use('/api/theme', themeRouter);
    return app;
}

// ============================================================================
// Default mock responses
// ============================================================================

const DEFAULT_THEME = {
    mode: 'system',
    primaryColor: '#3b82f6',
    preset: 'default',
};

// ============================================================================
// BL-1: Mode validation — current behavior
// ============================================================================

describe('BL-1: Mode validation', () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        mockGetUserConfig.mockResolvedValue({ theme: { ...DEFAULT_THEME } });
        mockUpdateUserConfig.mockResolvedValue({ theme: { ...DEFAULT_THEME } });
    });

    it('accepts mode "light"', async () => {
        const res = await request(app)
            .put('/api/theme')
            .send({ theme: { mode: 'light' } });
        expect(res.status).toBe(200);
    });

    it('accepts mode "dark"', async () => {
        const res = await request(app)
            .put('/api/theme')
            .send({ theme: { mode: 'dark' } });
        expect(res.status).toBe(200);
    });

    it('accepts mode "system"', async () => {
        const res = await request(app)
            .put('/api/theme')
            .send({ theme: { mode: 'system' } });
        expect(res.status).toBe(200);
    });

    it('rejects invalid mode "invalid-mode"', async () => {
        const res = await request(app)
            .put('/api/theme')
            .send({ theme: { mode: 'invalid-mode' } });
        expect(res.status).toBe(400);
    });

    it('accepts preset IDs as mode values', async () => {
        for (const presetMode of ['dark-pro', 'nord', 'catppuccin', 'dracula', 'light', 'noir', 'nebula']) {
            const res = await request(app)
                .put('/api/theme')
                .send({ theme: { mode: presetMode } });
            expect(res.status).toBe(200);
        }
    });

    it('accepts mode "custom"', async () => {
        const res = await request(app)
            .put('/api/theme')
            .send({ theme: { mode: 'custom' } });
        expect(res.status).toBe(200);
    });

    it('rejects non-object theme', async () => {
        const res = await request(app)
            .put('/api/theme')
            .send({ theme: 'not-an-object' });
        expect(res.status).toBe(400);
    });

    it('rejects missing theme', async () => {
        const res = await request(app)
            .put('/api/theme')
            .send({});
        expect(res.status).toBe(400);
    });
});

// ============================================================================
// BL-2: Preset validation — current behavior (no validation exists yet)
// ============================================================================

describe('BL-2: Preset pass-through (no validation yet)', () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        mockGetUserConfig.mockResolvedValue({ theme: { ...DEFAULT_THEME } });
        mockUpdateUserConfig.mockResolvedValue({ theme: { ...DEFAULT_THEME } });
    });

    it('accepts all VALID_PRESETS', async () => {
        for (const preset of ['dark-pro', 'nord', 'catppuccin', 'dracula', 'light', 'noir', 'nebula']) {
            const res = await request(app)
                .put('/api/theme')
                .send({ theme: { preset } });
            expect(res.status).toBe(200);
        }
    });

    it('rejects unknown preset (validation now enforced)', async () => {
        const res = await request(app)
            .put('/api/theme')
            .send({ theme: { preset: 'non-existent-preset' } });
        expect(res.status).toBe(400);
    });
});

// ============================================================================
// BL-3: LastSelectedTheme validation — current behavior (no validation)
// ============================================================================

describe('BL-3: LastSelectedTheme pass-through (no validation yet)', () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        mockGetUserConfig.mockResolvedValue({ theme: { ...DEFAULT_THEME } });
        mockUpdateUserConfig.mockResolvedValue({ theme: { ...DEFAULT_THEME } });
    });

    it('accepts valid lastSelectedTheme', async () => {
        const res = await request(app)
            .put('/api/theme')
            .send({ theme: { lastSelectedTheme: 'nord' } });
        expect(res.status).toBe(200);
    });

    it('rejects invalid lastSelectedTheme', async () => {
        const res = await request(app)
            .put('/api/theme')
            .send({ theme: { lastSelectedTheme: 'fake-theme' } });
        expect(res.status).toBe(400);
    });
});

// ============================================================================
// BL-4: LoginTheme sync — only syncs for admin users with a preset
// ============================================================================

describe('BL-4: LoginTheme sync for admin users', () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserConfig.mockResolvedValue({ theme: { ...DEFAULT_THEME } });
        mockUpdateUserConfig.mockResolvedValue({ theme: { ...DEFAULT_THEME, preset: 'nord' } });
    });

    it('syncs loginTheme when admin saves with a preset', async () => {
        app = createTestApp({ group: 'admin' });
        await request(app)
            .put('/api/theme')
            .send({ theme: { preset: 'nord' } });

        expect(mockUpdateSystemConfig).toHaveBeenCalledWith({ loginTheme: 'nord' });
    });

    it('does NOT sync loginTheme for non-admin users', async () => {
        app = createTestApp({ group: 'user' });
        await request(app)
            .put('/api/theme')
            .send({ theme: { preset: 'nord' } });

        expect(mockUpdateSystemConfig).not.toHaveBeenCalled();
    });

    it('does NOT sync loginTheme when preset is not in VALID_PRESETS', async () => {
        // After unification: loginTheme sync requires VALID_PRESETS membership.
        // 'default' is not a valid preset, so sync should not fire.
        app = createTestApp({ group: 'admin' });
        mockUpdateUserConfig.mockResolvedValue({ theme: { mode: 'dark', preset: 'default', primaryColor: '#3b82f6' } });

        await request(app)
            .put('/api/theme')
            .send({ theme: { mode: 'dark' } });

        expect(mockUpdateSystemConfig).not.toHaveBeenCalled();
    });
});

// ============================================================================
// BL-5: LoginTheme custom mode fallback — characterize current behavior
// ============================================================================

describe('BL-5: LoginTheme with custom mode (current behavior)', () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp({ group: 'admin' });
        mockGetUserConfig.mockResolvedValue({ theme: { ...DEFAULT_THEME } });
    });

    it('accepts mode "custom" and syncs loginTheme from lastSelectedTheme', async () => {
        mockUpdateUserConfig.mockResolvedValue({
            theme: { mode: 'custom', preset: 'catppuccin', lastSelectedTheme: 'catppuccin' }
        });

        const res = await request(app)
            .put('/api/theme')
            .send({ theme: { mode: 'custom', preset: 'catppuccin', lastSelectedTheme: 'catppuccin' } });

        expect(res.status).toBe(200);
        expect(mockUpdateUserConfig).toHaveBeenCalled();
        // Custom mode: syncs lastSelectedTheme as loginTheme
        expect(mockUpdateSystemConfig).toHaveBeenCalledWith({ loginTheme: 'catppuccin' });
    });

    it('does NOT sync loginTheme when custom mode resolves to invalid preset', async () => {
        // When custom mode is sent with no lastSelectedTheme, the merge preserves
        // existing preset ('default'), which is not in VALID_PRESETS, so sync is skipped.
        mockUpdateUserConfig.mockResolvedValue({
            theme: { mode: 'custom', preset: 'default' }
        });

        const res = await request(app)
            .put('/api/theme')
            .send({ theme: { mode: 'custom' } });

        expect(res.status).toBe(200);
        // 'default' is not in VALID_PRESETS, so loginTheme sync is skipped
        expect(mockUpdateSystemConfig).not.toHaveBeenCalled();
    });
});

// ============================================================================
// BL-6: SSE broadcast after save
// ============================================================================

describe('BL-6: SSE broadcast after successful save', () => {
    let app: ReturnType<typeof createTestApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        mockGetUserConfig.mockResolvedValue({ theme: { ...DEFAULT_THEME } });
        mockUpdateUserConfig.mockResolvedValue({ theme: { ...DEFAULT_THEME, preset: 'dark-pro' } });
    });

    it('broadcasts settings:theme event after successful PUT', async () => {
        await request(app)
            .put('/api/theme')
            .send({ theme: { preset: 'dark-pro' } });

        expect(mockBroadcastToUser).toHaveBeenCalledWith(
            'user-1',
            'settings:theme',
            expect.objectContaining({
                action: 'updated',
                theme: expect.any(Object),
            })
        );
    });

    it('does NOT broadcast on validation failure', async () => {
        await request(app)
            .put('/api/theme')
            .send({ theme: 'not-an-object' });

        expect(mockBroadcastToUser).not.toHaveBeenCalled();
    });

    it('broadcasts settings:theme on reset', async () => {
        mockUpdateUserConfig.mockResolvedValue({
            theme: { mode: 'system', primaryColor: '#3b82f6', preset: 'default' }
        });

        await request(app)
            .post('/api/theme/reset');

        expect(mockBroadcastToUser).toHaveBeenCalledWith(
            'user-1',
            'settings:theme',
            expect.objectContaining({
                action: 'reset',
            })
        );
    });
});

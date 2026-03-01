/**
 * Tests for Overseerr Auto-Match Service
 *
 * Tests the auto-match logic that links Framerr users to Overseerr accounts
 * by matching Plex usernames, including permission caching.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

// Mock integrationInstances
const mockGetInstancesByType = vi.fn();
vi.mock('../db/integrationInstances', () => ({
    getInstancesByType: (...args: unknown[]) => mockGetInstancesByType(...args),
}));

// Mock linkedAccounts
const mockGetLinkedAccount = vi.fn();
const mockLinkAccount = vi.fn();
const mockGetPlexLinkedUsers = vi.fn();
const mockGetUsersLinkedToService = vi.fn();
const mockUpdateLinkedAccountMetadata = vi.fn();
vi.mock('../db/linkedAccounts', () => ({
    getLinkedAccount: (...args: unknown[]) => mockGetLinkedAccount(...args),
    linkAccount: (...args: unknown[]) => mockLinkAccount(...args),
    getPlexLinkedUsers: () => mockGetPlexLinkedUsers(),
    getUsersLinkedToService: (...args: unknown[]) => mockGetUsersLinkedToService(...args),
    updateLinkedAccountMetadata: (...args: unknown[]) => mockUpdateLinkedAccountMetadata(...args),
}));

// Mock integration registry (getPlugin returns adapter with mock get)
const mockAdapterGet = vi.fn();
vi.mock('../integrations/registry', () => ({
    getPlugin: () => ({
        adapter: {
            get: (...args: unknown[]) => mockAdapterGet(...args),
        },
    }),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// ============================================================================
// Test Data
// ============================================================================

const MOCK_OVERSEERR_INSTANCE = {
    id: 'overseerr-abc123',
    type: 'overseerr',
    displayName: 'Overseerr',
    config: { url: 'http://overseerr:5055', apiKey: 'test-api-key' },
    enabled: true,
    createdAt: '2024-01-01',
    updatedAt: null,
};

const MOCK_OVERSEERR_USERS = [
    { id: 1, plexUsername: 'alex_plex', username: 'alex', email: 'alex@test.com', permissions: 0x4000 | 2 }, // MANAGE_REQUESTS + REQUEST
    { id: 2, plexUsername: 'sarah_plex', username: 'sarah', email: 'sarah@test.com', permissions: 2 }, // REQUEST only
    { id: 3, plexUsername: null, username: 'marcus', email: 'marcus@test.com', permissions: 2 }, // No Plex link
];

// ============================================================================
// Import service under test (after mocks)
// ============================================================================

import { tryAutoMatchSingleUser, tryAutoMatchAllUsers } from '../services/overseerrAutoMatch';

// ============================================================================
// Tests
// ============================================================================

describe('tryAutoMatchSingleUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetInstancesByType.mockReturnValue([MOCK_OVERSEERR_INSTANCE]);
        mockAdapterGet.mockResolvedValue({
            data: {
                pageInfo: { pages: 1, pageSize: 50, results: 3, page: 1 },
                results: MOCK_OVERSEERR_USERS,
            },
        });
    });

    it('should auto-link when matching plexUsername is found', async () => {
        mockGetLinkedAccount.mockImplementation((userId: string, service: string) => {
            if (service === 'plex') return { externalUsername: 'alex_plex', externalId: '12345' };
            return null; // No existing Overseerr link
        });

        await tryAutoMatchSingleUser('user-1');

        expect(mockLinkAccount).toHaveBeenCalledWith('user-1', 'overseerr', expect.objectContaining({
            externalId: '1',
            externalUsername: 'alex_plex',
            metadata: expect.objectContaining({
                linkedVia: 'auto-match',
                permissions: MOCK_OVERSEERR_USERS[0].permissions,
            }),
        }));
    });

    it('should match case-insensitively', async () => {
        mockGetLinkedAccount.mockImplementation((_userId: string, service: string) => {
            if (service === 'plex') return { externalUsername: 'ALEX_PLEX', externalId: '12345' };
            return null;
        });

        await tryAutoMatchSingleUser('user-1');

        expect(mockLinkAccount).toHaveBeenCalledWith('user-1', 'overseerr', expect.objectContaining({
            externalId: '1',
        }));
    });

    it('should skip when user has no Plex account linked', async () => {
        mockGetLinkedAccount.mockReturnValue(null);

        await tryAutoMatchSingleUser('user-1');

        expect(mockLinkAccount).not.toHaveBeenCalled();
        expect(mockAdapterGet).not.toHaveBeenCalled();
    });

    it('should skip when no matching Overseerr user exists', async () => {
        mockGetLinkedAccount.mockImplementation((_userId: string, service: string) => {
            if (service === 'plex') return { externalUsername: 'unknown_user', externalId: '99' };
            return null;
        });

        await tryAutoMatchSingleUser('user-1');

        expect(mockLinkAccount).not.toHaveBeenCalled();
    });

    it('should refresh permissions when already linked to Overseerr', async () => {
        mockGetLinkedAccount.mockImplementation((_userId: string, service: string) => {
            if (service === 'plex') return { externalUsername: 'alex_plex', externalId: '12345' };
            if (service === 'overseerr') return { externalId: '1', metadata: { permissions: 0 } };
            return null;
        });

        // Mock the single-user permissions fetch
        mockAdapterGet.mockResolvedValue({
            data: { id: 1, permissions: 0x4000 | 2 },
        });

        await tryAutoMatchSingleUser('user-1');

        // Should NOT create a new link
        expect(mockLinkAccount).not.toHaveBeenCalled();
        // Should update permissions
        expect(mockUpdateLinkedAccountMetadata).toHaveBeenCalledWith('user-1', 'overseerr', expect.objectContaining({
            permissions: 0x4000 | 2,
        }));
    });

    it('should skip when no Overseerr instances exist', async () => {
        mockGetInstancesByType.mockReturnValue([]);
        mockGetLinkedAccount.mockImplementation((_userId: string, service: string) => {
            if (service === 'plex') return { externalUsername: 'alex_plex', externalId: '12345' };
            return null;
        });

        await tryAutoMatchSingleUser('user-1');

        expect(mockLinkAccount).not.toHaveBeenCalled();
        expect(mockAdapterGet).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
        mockGetLinkedAccount.mockImplementation((_userId: string, service: string) => {
            if (service === 'plex') return { externalUsername: 'alex_plex', externalId: '12345' };
            return null;
        });
        mockAdapterGet.mockRejectedValue(new Error('Connection refused'));

        // Should NOT throw
        await expect(tryAutoMatchSingleUser('user-1')).resolves.not.toThrow();
        expect(mockLinkAccount).not.toHaveBeenCalled();
    });
});

describe('tryAutoMatchAllUsers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetInstancesByType.mockReturnValue([MOCK_OVERSEERR_INSTANCE]);
        mockGetUsersLinkedToService.mockReturnValue([]);
        mockAdapterGet.mockResolvedValue({
            data: {
                pageInfo: { pages: 1, pageSize: 50, results: 3, page: 1 },
                results: MOCK_OVERSEERR_USERS,
            },
        });
    });

    it('should bulk link multiple matched users', async () => {
        mockGetPlexLinkedUsers.mockReturnValue([
            { userId: 'user-1', plexUsername: 'alex_plex' },
            { userId: 'user-2', plexUsername: 'sarah_plex' },
        ]);

        await tryAutoMatchAllUsers();

        expect(mockLinkAccount).toHaveBeenCalledTimes(2);
        expect(mockLinkAccount).toHaveBeenCalledWith('user-1', 'overseerr', expect.objectContaining({
            externalId: '1',
            metadata: expect.objectContaining({ permissions: MOCK_OVERSEERR_USERS[0].permissions }),
        }));
        expect(mockLinkAccount).toHaveBeenCalledWith('user-2', 'overseerr', expect.objectContaining({
            externalId: '2',
            metadata: expect.objectContaining({ permissions: MOCK_OVERSEERR_USERS[1].permissions }),
        }));
    });

    it('should refresh permissions for already-linked users', async () => {
        mockGetPlexLinkedUsers.mockReturnValue([
            { userId: 'user-1', plexUsername: 'alex_plex' },
        ]);
        mockGetUsersLinkedToService.mockReturnValue([
            { userId: 'user-1', externalId: '1' },
        ]);
        mockGetLinkedAccount.mockReturnValue({ externalId: '1', metadata: { permissions: 0 } });

        await tryAutoMatchAllUsers();

        // Should NOT create a new link
        expect(mockLinkAccount).not.toHaveBeenCalled();
        // Should update permissions
        expect(mockUpdateLinkedAccountMetadata).toHaveBeenCalledWith('user-1', 'overseerr', expect.objectContaining({
            permissions: MOCK_OVERSEERR_USERS[0].permissions,
        }));
    });

    it('should skip when no Overseerr instances exist', async () => {
        mockGetInstancesByType.mockReturnValue([]);
        mockGetPlexLinkedUsers.mockReturnValue([{ userId: 'user-1', plexUsername: 'alex' }]);

        await tryAutoMatchAllUsers();

        expect(mockAdapterGet).not.toHaveBeenCalled();
        expect(mockLinkAccount).not.toHaveBeenCalled();
    });

    it('should skip when no Plex-linked users exist', async () => {
        mockGetPlexLinkedUsers.mockReturnValue([]);

        await tryAutoMatchAllUsers();

        expect(mockAdapterGet).not.toHaveBeenCalled();
        expect(mockLinkAccount).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
        mockGetPlexLinkedUsers.mockReturnValue([
            { userId: 'user-1', plexUsername: 'alex_plex' },
        ]);
        mockAdapterGet.mockRejectedValue(new Error('Overseerr offline'));

        await expect(tryAutoMatchAllUsers()).resolves.not.toThrow();
        expect(mockLinkAccount).not.toHaveBeenCalled();
    });

    it('should skip unmatched users without errors', async () => {
        mockGetPlexLinkedUsers.mockReturnValue([
            { userId: 'user-1', plexUsername: 'unknown_user' },
        ]);

        await tryAutoMatchAllUsers();

        expect(mockLinkAccount).not.toHaveBeenCalled();
    });
});

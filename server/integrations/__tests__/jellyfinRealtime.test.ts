/**
 * Jellyfin Realtime Manager — WebSocket auth
 *
 * Jellyfin 12 rejects legacy ?api_key= on /socket. Auth must use the same
 * MediaBrowser Authorization header as the HTTP adapter (issue #65).
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const { MockWebSocket, webSocketCtor } = vi.hoisted(() => {
    class MockWebSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        readyState = MockWebSocket.CONNECTING;
        url: string;
        options: unknown;
        on = vi.fn();
        close = vi.fn();

        constructor(url: string, options?: unknown) {
            this.url = url;
            this.options = options;
            webSocketCtor(url, options);
        }
    }

    const webSocketCtor = vi.fn();
    return { MockWebSocket, webSocketCtor };
});

vi.mock('ws', () => ({
    default: MockWebSocket,
}));

vi.mock('../../utils/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../utils/urlHelper', () => ({
    translateHostUrl: vi.fn((url: string) => url),
}));

vi.mock('../registry', () => ({
    getPlugin: vi.fn(),
}));

import { realtime } from '../../integrations/jellyfin/realtime';
import type { PluginInstance } from '../../integrations/types';

function makeInstance(): PluginInstance {
    return {
        id: 'jf-1',
        type: 'jellyfin',
        name: 'Test Jellyfin',
        config: {
            url: 'http://jellyfin:8096',
            apiKey: 'test-api-key',
            userId: 'user-1',
        },
    };
}

describe('JellyfinRealtimeManager WebSocket auth', () => {
    beforeEach(() => {
        webSocketCtor.mockClear();
    });

    it('connects to /socket with MediaBrowser Authorization header (no legacy api_key)', () => {
        const manager = realtime.createManager(makeInstance(), vi.fn());
        manager.connect();

        expect(webSocketCtor).toHaveBeenCalledTimes(1);
        const [url, options] = webSocketCtor.mock.calls[0] as [string, Record<string, unknown>];

        expect(url).toBe('ws://jellyfin:8096/socket');
        expect(url).not.toContain('api_key');
        expect(url).not.toContain('ApiKey');
        expect(options).toMatchObject({
            rejectUnauthorized: false,
            headers: {
                Authorization: 'MediaBrowser Token="test-api-key"',
            },
        });
    });
});

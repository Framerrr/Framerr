/**
 * Mock Factory Utilities
 *
 * Centralized, typed mock factories for common entities.
 * Each factory returns a valid default object that can be
 * overridden with partial properties.
 *
 * Usage:
 *   import { createMockUser, createMockWidget } from '@/test/mocks';
 *
 *   const user = createMockUser({ isAdmin: false });
 *   const widget = createMockWidget({ type: 'plex' });
 */
import type { User, UserGroup } from '@shared/types/user';
import type { FramerrWidget, WidgetLayout, WidgetConfig } from '@shared/types/widget';
import type { IntegrationInstance, IntegrationConfig } from '@/api/endpoints/integrations';

/**
 * Creates a mock User object.
 * Source type: shared/types/user.ts (User interface, lines 13-27)
 */
export function createMockUser(overrides?: Partial<User>): User {
    return {
        id: 'user-1',
        username: 'testuser',
        email: 'test@test.com',
        isAdmin: true,
        group: 'admin' as UserGroup,
        ...overrides,
    };
}

/**
 * Creates a mock FramerrWidget object.
 * Source type: shared/types/widget.ts (FramerrWidget interface, lines 54-72)
 */
export function createMockWidget(overrides?: Partial<FramerrWidget>): FramerrWidget {
    return {
        id: 'widget-test',
        type: 'clock',
        layout: { x: 0, y: 0, w: 4, h: 2 } as WidgetLayout,
        config: {} as WidgetConfig,
        ...overrides,
    };
}

/**
 * Creates a mock IntegrationInstance object.
 * Source type: src/api/endpoints/integrations.ts (IntegrationInstance interface, lines 9-18)
 */
export function createMockIntegrationInstance(
    overrides?: Partial<IntegrationInstance>,
): IntegrationInstance {
    return {
        id: 'plex',
        type: 'plex',
        name: 'Test Plex',
        enabled: true,
        config: {} as IntegrationConfig,
        ...overrides,
    };
}

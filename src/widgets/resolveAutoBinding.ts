/**
 * resolveAutoBinding - Shared integration auto-binding for widgets
 *
 * Single source of truth for determining which integrations to bind
 * when a widget is first added to a dashboard.
 *
 * BINDING PATTERNS:
 * 1. integrationGroups defined → Multi-slot binding (Calendar, Media Search)
 *    For each group, find first enabled instance matching group's types.
 *    Sets { [group.key]: [instanceId] } (array format)
 *
 * 2. No groups, has compatibleIntegrations → Single-slot binding (most widgets)
 *    Loop compatible types in order, bind first enabled instance found.
 *    Sets { integrationId: instanceId }
 *
 * 3. Neither → No binding, returns {}
 *
 * Used by: DragPreviewPortal, DropTransitionOverlay, handleAddWidgetFromModal
 */

import { getWidgetMetadata } from './registry';

// Minimal integration shape needed for binding
interface BindableIntegration {
    id: string;
    type: string;
    enabled: boolean;
}

/**
 * Resolve integration auto-binding config for a widget type.
 *
 * @param widgetType - Widget type ID (e.g. 'calendar', 'sonarr')
 * @param integrations - Available integrations (from React Query cache)
 * @returns Config additions to merge into widget config (may be empty)
 */
export function resolveAutoBinding(
    widgetType: string,
    integrations: BindableIntegration[]
): Record<string, unknown> {
    const metadata = getWidgetMetadata(widgetType);
    if (!metadata) return {};

    const enabledIntegrations = integrations.filter(i => i.enabled);

    // Pattern 1: Multi-slot — widget declares integrationGroups
    if (metadata.integrationGroups && metadata.integrationGroups.length > 0) {
        const binding: Record<string, string[]> = {};

        for (const group of metadata.integrationGroups) {
            const match = enabledIntegrations.find(i => group.types.includes(i.type));
            if (match) {
                binding[group.key] = [match.id];
            }
        }

        return binding;
    }

    // Pattern 2: Single-slot — widget declares compatibleIntegrations
    const compatibleTypes = metadata.compatibleIntegrations || [];
    if (compatibleTypes.length > 0) {
        for (const type of compatibleTypes) {
            const match = enabledIntegrations.find(i => i.type === type);
            if (match) {
                return { integrationId: match.id };
            }
        }
    }

    // Pattern 3: No integration binding
    return {};
}

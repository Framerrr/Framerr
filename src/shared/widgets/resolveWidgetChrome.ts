/**
 * resolveWidgetChrome — single source of truth for widget tile title/icon.
 *
 * Used by dashboard chrome, DisplaySettings, Active Widgets, and resize modal.
 * Config modal header stays on plugin identity ("Configure {pluginName}").
 */

import { getWidgetIconName, getWidgetMetadata } from '../../widgets/registry';
import type { FramerrWidget } from '../../../shared/types/widget';
import { resolveEffectiveIntegrationId } from './resolveEffectiveIntegrationId';

export interface ChromeIntegrationRef {
    id: string;
    type: string;
    name?: string;
    displayName?: string;
}

export interface ChromeSchemaRef {
    name?: string;
    icon?: string;
}

export interface ResolveWidgetChromeInput {
    widget: Pick<FramerrWidget, 'type' | 'config'>;
    schemas?: Record<string, ChromeSchemaRef> | null;
    integrations?: ChromeIntegrationRef[] | null;
}

export interface ResolvedWidgetChrome {
    title: string;
    iconName: string;
}

function instanceLabel(instance: ChromeIntegrationRef): string {
    return (instance.displayName || instance.name || '').trim();
}

function findBoundInstance(
    integrationId: string | undefined,
    integrations: ChromeIntegrationRef[] | null | undefined
): ChromeIntegrationRef | undefined {
    if (!integrationId || !integrations?.length) return undefined;
    return integrations.find((i) => i.id === integrationId);
}

function derivedTitle(
    pluginName: string,
    instance: ChromeIntegrationRef | undefined
): string {
    if (instance) {
        const label = instanceLabel(instance);
        if (label) return label;
    }
    return pluginName;
}

function derivedIconName(
    widgetType: string,
    instance: ChromeIntegrationRef | undefined,
    schemas: Record<string, ChromeSchemaRef> | null | undefined
): string {
    if (instance) {
        const schemaIcon = schemas?.[instance.type]?.icon;
        if (schemaIcon) return schemaIcon;
    }
    return getWidgetIconName(widgetType);
}

/**
 * True when stored value should win over derived branding.
 * - Explicit override flag true → always
 * - Explicit false → never
 * - Flag missing (legacy): treat as user-owned only if value differs from derived default
 */
function isEffectiveOverride(
    flag: unknown,
    stored: string | undefined,
    derived: string
): boolean {
    if (flag === true) return Boolean(stored && stored.trim());
    if (flag === false) return false;
    // Legacy: no flag
    if (!stored || !stored.trim()) return false;
    return stored.trim() !== derived;
}

export function resolveWidgetChrome({
    widget,
    schemas,
    integrations,
}: ResolveWidgetChromeInput): ResolvedWidgetChrome {
    const metadata = getWidgetMetadata(widget.type);
    const pluginName = metadata?.name || 'Widget';
    const config = (widget.config || {}) as Record<string, unknown>;

    // Multi-integration widgets (e.g. Calendar) must not inherit chrome from a
    // stale singular `integrationId` (historically could point at unrelated
    // types like qBittorrent). Only an explicit user title/icon override wins.
    if (metadata?.multiIntegration) {
        const storedTitle = typeof config.title === 'string' ? config.title : undefined;
        const storedIcon = typeof config.customIcon === 'string' ? config.customIcon : undefined;
        const title =
            config.titleOverridden === true && storedTitle?.trim()
                ? storedTitle.trim()
                : pluginName;
        const iconName =
            config.iconOverridden === true && storedIcon?.trim()
                ? storedIcon.trim()
                : getWidgetIconName(widget.type);
        return { title, iconName };
    }

    const metadataCompatible = (metadata?.compatibleIntegrations || []).map((t) => t.toLowerCase());
    const forceClear = config.forceClearIntegration === true;
    const compatibleInstances = (integrations || []).filter((i) =>
        metadataCompatible.includes((i.type || '').toLowerCase()),
    );
    const configuredId = config.integrationId as string | undefined;
    const effectiveId = resolveEffectiveIntegrationId(
        configuredId,
        compatibleInstances.map((i) => ({ id: i.id, type: i.type })),
        forceClear,
    );
    const instance = findBoundInstance(effectiveId ?? undefined, integrations);

    const titleDerived = derivedTitle(pluginName, instance);
    const iconDerived = derivedIconName(widget.type, instance, schemas);

    const storedTitle = typeof config.title === 'string' ? config.title : undefined;
    const storedIcon = typeof config.customIcon === 'string' ? config.customIcon : undefined;

    const title = isEffectiveOverride(config.titleOverridden, storedTitle, titleDerived)
        ? storedTitle!.trim()
        : titleDerived;

    const iconName = isEffectiveOverride(config.iconOverridden, storedIcon, iconDerived)
        ? storedIcon!.trim()
        : iconDerived;

    return { title, iconName };
}

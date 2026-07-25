export interface EffectiveBindInstance {
    id: string;
    type: string;
}

/**
 * The single effective single-slot bind rule. Used by useIntegrationFallback
 * (data plane), resolveWidgetChrome, and SingleIntegrationSelector so all three
 * cannot drift.
 */
export function resolveEffectiveIntegrationId(
    configuredId: string | undefined,
    compatibleInstances: EffectiveBindInstance[],
    forceClear: boolean,
): string | null {
    if (forceClear) {
        return null;
    }
    if (configuredId && compatibleInstances.some((i) => i.id === configuredId)) {
        return configuredId;
    }
    return compatibleInstances[0]?.id ?? null;
}

/** One config write op to apply (value undefined = delete the key). */
export interface ConfigUpdate {
    key: string;
    value: unknown;
}

/**
 * Selector clear/select semantics for a single-slot integration change.
 */
export function resolveSingleSlotClearUpdates(
    newId: string | undefined,
    config: { titleOverridden?: unknown; iconOverridden?: unknown },
): ConfigUpdate[] {
    if (newId) {
        return [
            { key: 'integrationId', value: newId },
            { key: 'forceClearIntegration', value: undefined },
        ];
    }

    const updates: ConfigUpdate[] = [
        { key: 'integrationId', value: undefined },
        { key: 'forceClearIntegration', value: true },
    ];

    if (!config.titleOverridden) {
        updates.push({ key: 'title', value: undefined });
    }
    if (!config.iconOverridden) {
        updates.push({ key: 'customIcon', value: undefined });
    }

    return updates;
}

import { describe, it, expect } from 'vitest';
import {
    resolveEffectiveIntegrationId,
    resolveSingleSlotClearUpdates,
} from '../resolveEffectiveIntegrationId';

const compatible = [
    { id: 'tautulli-1', type: 'tautulli' },
    { id: 'tautulli-2', type: 'tautulli' },
];

describe('resolveEffectiveIntegrationId', () => {
    it('returns null when forceClear is true', () => {
        expect(resolveEffectiveIntegrationId('tautulli-1', compatible, true)).toBeNull();
    });

    it('returns configured id when present and compatible', () => {
        expect(resolveEffectiveIntegrationId('tautulli-2', compatible, false)).toBe('tautulli-2');
    });

    it('returns first compatible when configured id is missing', () => {
        expect(resolveEffectiveIntegrationId(undefined, compatible, false)).toBe('tautulli-1');
    });

    it('returns null when compatible list is empty', () => {
        expect(resolveEffectiveIntegrationId(undefined, [], false)).toBeNull();
    });

    it('falls back to first compatible when configured id is absent from list', () => {
        expect(resolveEffectiveIntegrationId('wrong-id', compatible, false)).toBe('tautulli-1');
    });
});

describe('resolveSingleSlotClearUpdates', () => {
    it('binds integration and clears forceClearIntegration flag on select', () => {
        expect(resolveSingleSlotClearUpdates('tautulli-1', {})).toEqual([
            { key: 'integrationId', value: 'tautulli-1' },
            { key: 'forceClearIntegration', value: undefined },
        ]);
    });

    it('clears integration and sets forceClearIntegration on unbind without overrides', () => {
        expect(resolveSingleSlotClearUpdates(undefined, {})).toEqual([
            { key: 'integrationId', value: undefined },
            { key: 'forceClearIntegration', value: true },
            { key: 'title', value: undefined },
            { key: 'customIcon', value: undefined },
        ]);
    });

    it('does not clear title/icon when user has overridden them', () => {
        expect(
            resolveSingleSlotClearUpdates(undefined, {
                titleOverridden: true,
                iconOverridden: true,
            }),
        ).toEqual([
            { key: 'integrationId', value: undefined },
            { key: 'forceClearIntegration', value: true },
        ]);
    });
});

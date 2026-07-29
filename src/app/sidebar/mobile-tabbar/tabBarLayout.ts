/**
 * Mobile tab bar layout prefs (v2 ordered slots).
 *
 * Custom link slots use a denormalized copy of a Link Grid `Link` — no live
 * `libraryLinkId` binding; the slot's `link` field is the source of truth.
 *
 * `iframeTab` slots store a live `tabId` reference to Settings → My Tabs;
 * label, icon, url, slug, and open behavior come from the tab entity at runtime.
 *
 * Invariants after sanitize:
 * - Exactly one Menu and one Settings
 * - At least one Dashboard bound to a dashboard id (legacy null → Home)
 * - 3–5 slots total
 * - Action ids unique; unknown actions dropped
 */

import type { Link, HttpMethod } from '@/widgets/link-grid/types';
import { resolveLinkNavigation } from '@/widgets/link-grid/utils/linkNavigation';

export const MAX_TAB_BAR_SLOTS = 5;
/** @deprecated use MAX_TAB_BAR_SLOTS — kept for older imports */
export const MAX_CUSTOM_ACTIONS = 2;

export type TabBarSlot =
    | { kind: 'menu' }
    | { kind: 'settings' }
    | { kind: 'dashboard'; dashboardId: string | null }
    | { kind: 'action'; actionId: string }
    | { kind: 'link'; link: Link }
    | { kind: 'iframeTab'; tabId: string };

export interface MobileTabBarPrefs {
    version: 2;
    slots: TabBarSlot[];
}

/** Legacy v1 shape (left/right customs around a fixed dashboard spine). */
interface MobileTabBarPrefsV1 {
    version: 1;
    left: string[];
    right: string[];
}

/** Factory layout. Pass homeDashboardId to bind the default dash nav to Home (preferred). */
export function createDefaultTabBarPrefs(homeDashboardId: string | null = null): MobileTabBarPrefs {
    return {
        version: 2,
        slots: [
            { kind: 'menu' },
            { kind: 'dashboard', dashboardId: homeDashboardId },
            { kind: 'action', actionId: 'profile' },
            { kind: 'settings' },
        ],
    };
}

/** Unbound factory (tests / fallback when Home is unknown). Prefer createDefaultTabBarPrefs(homeId). */
export const DEFAULT_TAB_BAR_PREFS: MobileTabBarPrefs = createDefaultTabBarPrefs(null);

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}

const HTTP_METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

function isValidTabBarLink(link: unknown): link is Link {
    if (!link || typeof link !== 'object') return false;
    const l = link as Record<string, unknown>;
    if (typeof l.id !== 'string' || typeof l.title !== 'string' || typeof l.icon !== 'string') {
        return false;
    }
    if (l.size !== 'circle' && l.size !== 'rectangle') return false;
    if (l.type !== 'link' && l.type !== 'action') return false;
    if (l.type === 'link') {
        if (typeof l.url !== 'string' || !l.url.trim()) return false;
        return resolveLinkNavigation(link as Link).kind !== 'dashboard';
    }
    const action = l.action;
    if (!action || typeof action !== 'object') return false;
    const a = action as Record<string, unknown>;
    if (typeof a.url !== 'string' || !a.url.trim()) return false;
    if (typeof a.method !== 'string' || !HTTP_METHODS.has(a.method as HttpMethod)) return false;
    return true;
}

function isSlot(value: unknown): value is TabBarSlot {
    if (!value || typeof value !== 'object') return false;
    const kind = (value as { kind?: unknown }).kind;
    if (kind === 'menu' || kind === 'settings') return true;
    if (kind === 'dashboard') {
        const id = (value as { dashboardId?: unknown }).dashboardId;
        return id === null || typeof id === 'string';
    }
    if (kind === 'action') {
        return typeof (value as { actionId?: unknown }).actionId === 'string';
    }
    if (kind === 'link') {
        const link = (value as { link?: unknown }).link;
        return isValidTabBarLink(link);
    }
    if (kind === 'iframeTab') {
        const tabId = (value as { tabId?: unknown }).tabId;
        return typeof tabId === 'string' && tabId.trim().length > 0;
    }
    return false;
}

function migrateV1(
    raw: MobileTabBarPrefsV1,
    knownIds: ReadonlySet<string>,
    homeDashboardId: string | null = null,
): TabBarSlot[] {
    const left = isStringArray(raw.left) ? raw.left : [];
    const right = isStringArray(raw.right) ? raw.right : [];
    const slots: TabBarSlot[] = [{ kind: 'menu' }];
    for (const id of left) {
        if (knownIds.has(id)) slots.push({ kind: 'action', actionId: id });
    }
    slots.push({ kind: 'dashboard', dashboardId: homeDashboardId });
    for (const id of right) {
        if (knownIds.has(id)) slots.push({ kind: 'action', actionId: id });
    }
    slots.push({ kind: 'settings' });
    return slots;
}

function normalizeSlots(
    input: TabBarSlot[],
    knownIds: ReadonlySet<string>,
    homeDashboardId: string | null = null,
    knownTabIds?: ReadonlySet<string>,
): TabBarSlot[] {
    const result: TabBarSlot[] = [];
    let sawMenu = false;
    let sawSettings = false;
    const seenActions = new Set<string>();
    const seenIframeTabIds = new Set<string>();

    for (const slot of input) {
        if (slot.kind === 'menu') {
            if (sawMenu) continue;
            sawMenu = true;
            result.push({ kind: 'menu' });
            continue;
        }
        if (slot.kind === 'settings') {
            if (sawSettings) continue;
            sawSettings = true;
            result.push({ kind: 'settings' });
            continue;
        }
        if (slot.kind === 'dashboard') {
            const rawId =
                typeof slot.dashboardId === 'string' && slot.dashboardId.trim()
                    ? slot.dashboardId.trim()
                    : null;
            // Legacy "Current" (null) and missing ids resolve to Home — no unbound slots.
            // Per-slot icons are ignored (icons live on the dashboard entity).
            result.push({
                kind: 'dashboard',
                dashboardId: rawId ?? homeDashboardId,
            });
            continue;
        }
        if (slot.kind === 'action') {
            if (!knownIds.has(slot.actionId) || seenActions.has(slot.actionId)) continue;
            seenActions.add(slot.actionId);
            result.push({ kind: 'action', actionId: slot.actionId });
            continue;
        }
        if (slot.kind === 'link') {
            if (isValidTabBarLink(slot.link)) {
                result.push({ kind: 'link', link: slot.link });
            }
            continue;
        }
        if (slot.kind === 'iframeTab') {
            const tabId = slot.tabId.trim();
            if (!tabId) continue;
            if (knownTabIds !== undefined && !knownTabIds.has(tabId)) continue;
            if (seenIframeTabIds.has(tabId)) continue;
            seenIframeTabIds.add(tabId);
            result.push({ kind: 'iframeTab', tabId });
        }
    }

    if (!sawMenu) result.unshift({ kind: 'menu' });
    if (!sawSettings) result.push({ kind: 'settings' });
    if (!result.some(s => s.kind === 'dashboard')) {
        const menuIdx = result.findIndex(s => s.kind === 'menu');
        result.splice(menuIdx + 1, 0, {
            kind: 'dashboard',
            dashboardId: homeDashboardId,
        });
    }

    while (result.length > MAX_TAB_BAR_SLOTS) {
        let removeIdx = -1;
        for (let i = result.length - 1; i >= 0; i--) {
            const s = result[i];
            if (s.kind === 'action' || s.kind === 'link' || s.kind === 'iframeTab') {
                removeIdx = i;
                break;
            }
        }
        if (removeIdx < 0) {
            const dashCount = result.filter(s => s.kind === 'dashboard').length;
            if (dashCount > 1) {
                for (let i = result.length - 1; i >= 0; i--) {
                    if (result[i].kind === 'dashboard') {
                        removeIdx = i;
                        break;
                    }
                }
            }
        }
        if (removeIdx < 0) break;
        result.splice(removeIdx, 1);
    }

    return result;
}

export function sanitizeTabBarPrefs(
    raw: unknown,
    knownIds: ReadonlySet<string>,
    homeDashboardId: string | null = null,
    knownTabIds?: ReadonlySet<string>,
): MobileTabBarPrefs {
    if (!raw || typeof raw !== 'object') {
        return createDefaultTabBarPrefs(homeDashboardId);
    }

    const obj = raw as Record<string, unknown>;

    // Prefer v2 slots whenever present (deepMerge may leave legacy left/right keys around).
    if (Array.isArray(obj.slots)) {
        return {
            version: 2,
            slots: normalizeSlots(obj.slots.filter(isSlot), knownIds, homeDashboardId, knownTabIds),
        };
    }

    // v1 → v2 migration
    if (obj.version === 1 || (isStringArray(obj.left) && isStringArray(obj.right))) {
        const slots = normalizeSlots(
            migrateV1(
                {
                    version: 1,
                    left: isStringArray(obj.left) ? obj.left : [],
                    right: isStringArray(obj.right) ? obj.right : [],
                },
                knownIds,
                homeDashboardId,
            ),
            knownIds,
            homeDashboardId,
            knownTabIds,
        );
        return { version: 2, slots };
    }

    return createDefaultTabBarPrefs(homeDashboardId);
}

export function resolveTabBarLayout(
    prefs: MobileTabBarPrefs | undefined,
    knownIds: ReadonlySet<string>,
    homeDashboardId: string | null = null,
    knownTabIds?: ReadonlySet<string>,
): TabBarSlot[] {
    return sanitizeTabBarPrefs(
        prefs ?? createDefaultTabBarPrefs(homeDashboardId),
        knownIds,
        homeDashboardId,
        knownTabIds,
    ).slots;
}

export function countDashboardSlots(prefs: MobileTabBarPrefs): number {
    return prefs.slots.filter(s => s.kind === 'dashboard').length;
}

export function canRemoveSlot(prefs: MobileTabBarPrefs, index: number): boolean {
    const slot = prefs.slots[index];
    if (!slot) return false;
    if (slot.kind === 'menu' || slot.kind === 'settings') return false;
    if (slot.kind === 'dashboard' && countDashboardSlots(prefs) <= 1) return false;
    return true;
}

export function moveSlot(prefs: MobileTabBarPrefs, from: number, to: number): MobileTabBarPrefs {
    if (from === to || from < 0 || to < 0 || from >= prefs.slots.length || to >= prefs.slots.length) {
        return prefs;
    }
    const slots = [...prefs.slots];
    const [item] = slots.splice(from, 1);
    slots.splice(to, 0, item);
    return { version: 2, slots };
}

export function removeSlotAt(prefs: MobileTabBarPrefs, index: number): MobileTabBarPrefs {
    if (!canRemoveSlot(prefs, index)) return prefs;
    const slots = prefs.slots.filter((_, i) => i !== index);
    return { version: 2, slots };
}

export function insertSlot(
    prefs: MobileTabBarPrefs,
    index: number,
    slot: TabBarSlot,
    knownIds: ReadonlySet<string>,
    homeDashboardId: string | null = null,
    knownTabIds?: ReadonlySet<string>,
): MobileTabBarPrefs {
    if (prefs.slots.length >= MAX_TAB_BAR_SLOTS) return prefs;
    const slots = [...prefs.slots];
    const at = Math.max(0, Math.min(index, slots.length));
    slots.splice(at, 0, slot);
    return sanitizeTabBarPrefs({ version: 2, slots }, knownIds, homeDashboardId, knownTabIds);
}

export function replaceSlot(
    prefs: MobileTabBarPrefs,
    index: number,
    slot: TabBarSlot,
    knownIds: ReadonlySet<string>,
    homeDashboardId: string | null = null,
    knownTabIds?: ReadonlySet<string>,
): MobileTabBarPrefs {
    if (index < 0 || index >= prefs.slots.length) return prefs;
    const slots = [...prefs.slots];
    slots[index] = slot;
    return sanitizeTabBarPrefs({ version: 2, slots }, knownIds, homeDashboardId, knownTabIds);
}

export function availableActions(prefs: MobileTabBarPrefs, knownOrder: string[]): string[] {
    const used = new Set(
        prefs.slots.filter((s): s is Extract<TabBarSlot, { kind: 'action' }> => s.kind === 'action').map(s => s.actionId),
    );
    return knownOrder.filter(id => !used.has(id));
}

export function prefsDeepEqual(a: MobileTabBarPrefs, b: MobileTabBarPrefs): boolean {
    if (a.version !== b.version || a.slots.length !== b.slots.length) return false;
    return a.slots.every((slot, i) => {
        const other = b.slots[i];
        if (slot.kind !== other.kind) return false;
        if (slot.kind === 'dashboard' && other.kind === 'dashboard') {
            return slot.dashboardId === other.dashboardId;
        }
        if (slot.kind === 'action' && other.kind === 'action') {
            return slot.actionId === other.actionId;
        }
        if (slot.kind === 'link' && other.kind === 'link') {
            return JSON.stringify(slot.link) === JSON.stringify(other.link);
        }
        if (slot.kind === 'iframeTab' && other.kind === 'iframeTab') {
            return slot.tabId === other.tabId;
        }
        return true;
    });
}

/** @deprecated zone helpers — editor uses ordered slots */
export function countCustoms(prefs: MobileTabBarPrefs): number {
    return prefs.slots.filter(s => s.kind === 'action').length;
}

/** @deprecated */
export function addCustomAction(
    prefs: MobileTabBarPrefs,
    id: string,
    _zone: 'left' | 'right',
    knownIds: ReadonlySet<string>,
): MobileTabBarPrefs {
    return insertSlot(prefs, prefs.slots.length - 1, { kind: 'action', actionId: id }, knownIds);
}

/** @deprecated */
export function removeCustomAction(prefs: MobileTabBarPrefs, id: string): MobileTabBarPrefs {
    const index = prefs.slots.findIndex(s => s.kind === 'action' && s.actionId === id);
    if (index < 0) return prefs;
    return removeSlotAt(prefs, index);
}

/** @deprecated */
export function moveCustomAction(
    prefs: MobileTabBarPrefs,
    id: string,
    _zone: 'left' | 'right',
    knownIds: ReadonlySet<string>,
): MobileTabBarPrefs {
    const index = prefs.slots.findIndex(s => s.kind === 'action' && s.actionId === id);
    if (index < 0) return prefs;
    const without = removeSlotAt(prefs, index);
    return insertSlot(without, without.slots.length - 1, { kind: 'action', actionId: id }, knownIds);
}

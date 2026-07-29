/**
 * Active dashboard resolution and context
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    ReactNode,
} from 'react';
import { useDashboardEdit } from './useDashboardEdit';
import { guardedNavigate } from '../settings/navigation/settingsConfig';
import { useDashboards } from '../api/hooks/useDashboards';
import type { DashboardMeta } from '../api/endpoints/dashboards';

export const LAST_DASHBOARD_STORAGE_KEY = 'framerr-last-dashboard';

export function parseDashboardIdFromHash(hash: string): string | null {
    const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!normalized.startsWith('dashboard/')) {
        return null;
    }
    const rest = normalized.slice('dashboard/'.length);
    const id = rest.split('?')[0]?.split('/')[0];
    return id && id.length > 0 ? id : null;
}

/** Bare dashboard routes that still need a concrete dashboard id in the URL. */
export function isUnresolvedDashboardHash(hash: string): boolean {
    const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!normalized || normalized === 'dashboard' || normalized === 'dashboard/') {
        return true;
    }
    return normalized.startsWith('dashboard?');
}

export interface ResolveActiveDashboardInput {
    deepLinkId: string | null;
    dashboards: Pick<DashboardMeta, 'id'>[];
    homeDashboardId: string;
    rememberLast: boolean;
    storedId: string | null;
    /** In-memory last dashboard this SPA session (cleared on refresh). */
    sessionId: string | null;
}

/**
 * Resolution order:
 * deep link → remember-last (localStorage) → session → Home → first dashboard
 */
export function resolveActiveDashboardId(input: ResolveActiveDashboardInput): string | null {
    const { dashboards, homeDashboardId, rememberLast, storedId, deepLinkId, sessionId } = input;

    if (dashboards.length === 0) {
        return null;
    }

    const validIds = new Set(dashboards.map(d => d.id));
    const pick = (id: string | null | undefined): string | null =>
        id && validIds.has(id) ? id : null;

    const fromDeepLink = pick(deepLinkId);
    if (fromDeepLink) {
        return fromDeepLink;
    }

    if (rememberLast) {
        const fromStorage = pick(storedId);
        if (fromStorage) {
            return fromStorage;
        }
    }

    const fromSession = pick(sessionId);
    if (fromSession) {
        return fromSession;
    }

    const fromHome = pick(homeDashboardId);
    if (fromHome) {
        return fromHome;
    }

    return dashboards[0]?.id ?? null;
}

interface ActiveDashboardContextValue {
    activeDashboardId: string | null;
    switchDashboard: (id: string) => void;
    rememberLastDashboard: boolean;
    homeDashboardId: string | null;
    dashboards: DashboardMeta[];
    isLoading: boolean;
}

const ActiveDashboardContext = createContext<ActiveDashboardContextValue | null>(null);

export function ActiveDashboardProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const dashboardEdit = useDashboardEdit();
    const { data, isLoading } = useDashboards();

    const dashboards = data?.dashboards ?? [];
    const homeDashboardId = data?.homeDashboardId ?? null;
    const rememberLastDashboard = data?.rememberLastDashboard ?? false;

    const [hashTick, setHashTick] = useState(0);
    /** Survives Settings/tab navigations; cleared on full page refresh */
    const [sessionDashboardId, setSessionDashboardId] = useState<string | null>(null);

    useEffect(() => {
        const onHashChange = (): void => setHashTick(t => t + 1);
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    const deepLinkId = useMemo(
        () => parseDashboardIdFromHash(window.location.hash),
        [hashTick]
    );

    const storedId = useMemo(() => {
        if (!rememberLastDashboard) {
            return null;
        }
        try {
            return localStorage.getItem(LAST_DASHBOARD_STORAGE_KEY);
        } catch {
            return null;
        }
    }, [rememberLastDashboard, hashTick]);

    const activeDashboardId = useMemo(() => {
        if (!data) {
            return null;
        }
        return resolveActiveDashboardId({
            deepLinkId,
            dashboards,
            homeDashboardId: data.homeDashboardId,
            rememberLast: rememberLastDashboard,
            storedId,
            sessionId: sessionDashboardId,
        });
    }, [data, deepLinkId, dashboards, rememberLastDashboard, storedId, sessionDashboardId]);

    // Keep session pointer in sync whenever we know which dashboard is active
    useEffect(() => {
        if (activeDashboardId) {
            setSessionDashboardId(activeDashboardId);
        }
    }, [activeDashboardId]);

    // Persist last dashboard only after prefs are loaded. While `data` is still
    // undefined, rememberLastDashboard defaults to false — clearing storage then
    // would wipe the saved id on every cold load before prefs arrive.
    useEffect(() => {
        if (!data) return;

        if (!rememberLastDashboard) {
            try {
                localStorage.removeItem(LAST_DASHBOARD_STORAGE_KEY);
            } catch {
                /* ignore */
            }
            return;
        }
        if (activeDashboardId) {
            try {
                localStorage.setItem(LAST_DASHBOARD_STORAGE_KEY, activeDashboardId);
            } catch {
                /* ignore */
            }
        }
    }, [data, rememberLastDashboard, activeDashboardId]);

    // Harden entry: / and #dashboard → #dashboard/{resolved} (last or Home)
    useEffect(() => {
        if (!activeDashboardId) return;
        const current = window.location.hash.replace(/^#/, '');
        if (!isUnresolvedDashboardHash(current)) return;
        const next = `dashboard/${activeDashboardId}`;
        if (current === next) return;
        const url = `${window.location.pathname}${window.location.search}#${next}`;
        window.history.replaceState(null, '', url);
        setHashTick(t => t + 1);
    }, [activeDashboardId]);

    const switchDashboard = useCallback(
        (id: string) => {
            if (!id) return;
            // Compare hash, not only activeDashboardId — same id while on Settings
            // (or another page) must still navigate back to that dashboard.
            const targetHash = `dashboard/${id}`;
            const current = window.location.hash.replace(/^#/, '');
            if (current === targetHash) {
                return;
            }
            const result = guardedNavigate(`#${targetHash}`, dashboardEdit);
            if (result === 'proceed') {
                window.location.hash = targetHash;
            }
        },
        [dashboardEdit]
    );

    const value = useMemo(
        (): ActiveDashboardContextValue => ({
            activeDashboardId,
            switchDashboard,
            rememberLastDashboard,
            homeDashboardId,
            dashboards,
            isLoading,
        }),
        [
            activeDashboardId,
            switchDashboard,
            rememberLastDashboard,
            homeDashboardId,
            dashboards,
            isLoading,
        ]
    );

    return (
        <ActiveDashboardContext.Provider value={value}>{children}</ActiveDashboardContext.Provider>
    );
}

export function useActiveDashboard(): ActiveDashboardContextValue {
    const ctx = useContext(ActiveDashboardContext);
    if (!ctx) {
        throw new Error('useActiveDashboard must be used within ActiveDashboardProvider');
    }
    return ctx;
}

/** For hooks that may run outside the provider (e.g. template preview). */
export function useOptionalActiveDashboard(): ActiveDashboardContextValue | null {
    return useContext(ActiveDashboardContext);
}

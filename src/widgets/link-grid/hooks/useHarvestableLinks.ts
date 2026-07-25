import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useDashboards } from '../../../api/hooks/useDashboards';
import { widgetsApi } from '../../../api/endpoints/widgets';
import type { WidgetConfig } from '../../../api/endpoints/widgets';
import { queryKeys } from '../../../api/queryKeys';
import type { Link, LinkGridWidgetConfig } from '../types';
import { resolveLinkNavigation } from '../utils/linkNavigation';

export interface HarvestedLink extends Link {
    /** Stable picker key — widget link ids are not unique across dashboards (clones share them). */
    harvestKey: string;
    sourceDashboardId: string;
    sourceDashboardName: string;
    sourceWidgetId: string;
    sourceWidgetTitle: string;
}

function isEligibleHarvestLink(l: Link): boolean {
    if (l.type === 'action') return true;
    if (l.type === 'link' && !!l.url?.trim()) {
        return resolveLinkNavigation(l).kind !== 'dashboard';
    }
    return false;
}

export function useHarvestableLinks(enabled: boolean): { links: HarvestedLink[]; isLoading: boolean } {
    const { data: dashboardsData } = useDashboards();
    const dashboards = dashboardsData?.dashboards ?? [];

    const queries = useQueries({
        queries: dashboards.map(d => ({
            queryKey: queryKeys.widgets.dashboard(d.id),
            queryFn: () => widgetsApi.getAll(d.id),
            enabled: enabled && dashboards.length > 0,
            // Harvest must see latest saved widget configs, not a warm dashboard cache
            // from before the user added a link. Unsaved edit-mode links still won't
            // appear until the dashboard is saved (API is the source of truth).
            staleTime: 0,
            refetchOnMount: 'always' as const,
        })),
    });

    const isLoading = enabled && (dashboards.length === 0 || queries.some(q => q.isLoading || q.isFetching));

    // Depend on resolved data snapshots, not the unstable `queries` array identity.
    const queryDataKey = queries.map(q => (q.dataUpdatedAt ?? 0)).join(',');

    const links = useMemo((): HarvestedLink[] => {
        if (!enabled) return [];

        const result: HarvestedLink[] = [];

        queries.forEach((query, index) => {
            const dashboard = dashboards[index];
            if (!dashboard || !query.data) return;

            const allWidgets = [
                ...(query.data.widgets ?? []),
                ...(query.data.mobileWidgets ?? []),
            ].filter(w => w.type === 'link-grid');

            for (const w of allWidgets) {
                const config = w.config as LinkGridWidgetConfig | undefined;
                const widgetLinks = config?.links ?? [];
                const widgetTitle = (w.config as WidgetConfig)?.title || 'Link Grid';

                for (const link of widgetLinks) {
                    if (!isEligibleHarvestLink(link)) continue;
                    result.push({
                        ...link,
                        harvestKey: `${dashboard.id}:${w.id}:${link.id}`,
                        sourceDashboardId: dashboard.id,
                        sourceDashboardName: dashboard.name,
                        sourceWidgetId: w.id,
                        sourceWidgetTitle: widgetTitle,
                    });
                }
            }
        });

        return result;
    }, [enabled, dashboards, queryDataKey, queries]);

    return { links, isLoading };
}

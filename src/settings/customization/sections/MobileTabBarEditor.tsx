/**
 * Mobile Tab Bar settings — edit by interacting with the live preview bar.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Hand,
    Home,
    Info,
    LayoutDashboard,
    Link as LinkIcon,
    AppWindow,
    Menu,
    Plus,
    BookOpen,
    Smartphone,
    Settings,
    Trash2,
} from 'lucide-react';
import { Button, Checkbox } from '@/shared/ui';
import { DropdownMenu } from '@/shared/ui/DropdownMenu/DropdownMenu';
import { SettingsSection } from '@/shared/ui/settings';
import { useNotifications } from '@/context/notification';
import { useActiveDashboard } from '@/context/ActiveDashboardContext';
import { useTabsList } from '@/api/hooks/useSettings';
import type { Tab } from '@/api/endpoints/tabs';
import { useSharedSidebar } from '@/app/sidebar/context/useSharedSidebar';
import {
    TAB_BAR_ACTIONS,
    TAB_BAR_ACTION_ORDER,
    TAB_BAR_KNOWN_IDS,
    MAX_TAB_BAR_SLOTS,
    createDefaultTabBarPrefs,
    availableActions,
    canRemoveSlot,
    insertSlot,
    moveSlot,
    prefsDeepEqual,
    removeSlotAt,
    replaceSlot,
    resolveTabBarLayout,
    useMobileTabBarLayout,
    type MobileTabBarPrefs,
    type TabBarSlot,
} from '@/app/sidebar/mobile-tabbar';
import { getIconComponent } from '@/utils/iconUtils';
import { queryKeys } from '@/api/queryKeys';
import { linkLibraryApi } from '@/api/endpoints/linkLibrary';
import { LinkFormFields } from '@/widgets/link-grid/components/LinkFormFields';
import { LinkSourceList } from '@/widgets/link-grid/components/LinkSourceList';
import { useLinkLibraryLinks } from '@/widgets/link-grid/hooks/useLinkLibrary';
import { useHarvestableLinks } from '@/widgets/link-grid/hooks/useHarvestableLinks';
import { buildLinkFromFormData, buildLibraryPayloadFromFormData } from '@/widgets/link-grid/utils/linkFormBuilders';
import { inferLinkTargetFields, resolveLinkNavigation } from '@/widgets/link-grid/utils/linkNavigation';
import { DEFAULT_FORM_DATA, type Link, type LinkFormData } from '@/widgets/link-grid/types';
import type { LibraryLink } from '@/widgets/link-grid/components/LinkLibraryPicker';

type LinkPanelState =
    | { mode: 'add' }
    | { mode: 'edit'; slotIndex: number; originalLinkId: string };

type IframeTabPanelState = { mode: 'add' } | { mode: 'edit'; slotIndex: number };

function prefillLinkFormFromLink(link: Link): LinkFormData {
    const target = inferLinkTargetFields(link);
    return {
        title: link.title || '',
        icon: link.icon || 'Link',
        size: link.size || 'circle',
        type: link.type || 'link',
        linkTarget: target.linkTarget,
        url: target.url,
        dashboardId: target.dashboardId,
        openInNewTab: target.openInNewTab,
        showIcon: true,
        showText: true,
        action: link.action ?? DEFAULT_FORM_DATA.action,
    };
}

function isTabBarEligibleLink(link: Link): boolean {
    return link.type === 'action' || (!!link.url?.trim() && resolveLinkNavigation(link).kind !== 'dashboard');
}

function slotKey(slot: TabBarSlot, index: number): string {
    if (slot.kind === 'action') return `action-${slot.actionId}`;
    if (slot.kind === 'dashboard') return `dashboard-${index}-${slot.dashboardId ?? 'home'}`;
    if (slot.kind === 'iframeTab') return `iframeTab-${slot.tabId}`;
    return `${slot.kind}-${index}`;
}

function initialSelectedIndex(prefs: MobileTabBarPrefs, homeId: string | null): number {
    const slots = resolveTabBarLayout(prefs, TAB_BAR_KNOWN_IDS, homeId);
    const dashboardIdx = slots.findIndex(s => s.kind === 'dashboard');
    return dashboardIdx >= 0 ? dashboardIdx : 0;
}

export function MobileTabBarEditor(): React.JSX.Element {
    const { prefs: serverPrefs, savePrefs } = useMobileTabBarLayout();
    const { dashboards, homeDashboardId } = useActiveDashboard();
    const [prefs, setPrefs] = useState<MobileTabBarPrefs>(serverPrefs);
    const [selected, setSelected] = useState<number | null>(() =>
        initialSelectedIndex(serverPrefs, homeDashboardId),
    );
    const [linkPanel, setLinkPanel] = useState<LinkPanelState | null>(null);
    const [iframeTabPanel, setIframeTabPanel] = useState<IframeTabPanelState | null>(null);
    const [linkFormData, setLinkFormData] = useState<LinkFormData>(DEFAULT_FORM_DATA);
    const [linkFormValid, setLinkFormValid] = useState(true);
    const [saveToLibrary, setSaveToLibrary] = useState(false);
    const queryClient = useQueryClient();
    const { data: libraryLinks = [] } = useLinkLibraryLinks();
    // Prefetch harvest as soon as Add Custom Link opens (not only when the picker is clicked),
    // so the trigger count is accurate and all dashboards are scanned up front.
    const { links: harvestedLinks, isLoading: harvestLoading } = useHarvestableLinks(
        linkPanel?.mode === 'add',
    );
    const { error: showError } = useNotifications();
    const { currentUser, unreadCount, renderIcon } = useSharedSidebar();
    const { data: tabsData, isLoading: tabsListLoading, isError: tabsListError } = useTabsList();
    const defaultPrefs = useMemo(
        () => createDefaultTabBarPrefs(homeDashboardId),
        [homeDashboardId],
    );
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';

    useEffect(() => {
        setPrefs(serverPrefs);
    }, [serverPrefs]);

    const enabledTabs = useMemo(
        () => (tabsData?.tabs ?? []).filter((t: Tab) => t.enabled !== false),
        [tabsData?.tabs],
    );

    const knownTabIds = useMemo((): ReadonlySet<string> | undefined => {
        if (tabsListLoading || !tabsData?.tabs) return undefined;
        return new Set(enabledTabs.map(t => t.id));
    }, [tabsData?.tabs, tabsListLoading, enabledTabs]);

    const pinnedTabIds = useMemo(
        () =>
            new Set(
                prefs.slots
                    .filter((s): s is Extract<TabBarSlot, { kind: 'iframeTab' }> => s.kind === 'iframeTab')
                    .map(s => s.tabId),
            ),
        [prefs.slots],
    );

    const tabsAvailableToPin = useMemo(
        () => enabledTabs.filter(t => !pinnedTabIds.has(t.id)),
        [enabledTabs, pinnedTabIds],
    );

    const tabsForIframePicker = useMemo(() => {
        if (iframeTabPanel?.mode === 'edit') {
            const slot = prefs.slots[iframeTabPanel.slotIndex];
            const currentId = slot?.kind === 'iframeTab' ? slot.tabId : null;
            return enabledTabs.filter(t => !pinnedTabIds.has(t.id) || t.id === currentId);
        }
        return tabsAvailableToPin;
    }, [iframeTabPanel, prefs.slots, enabledTabs, pinnedTabIds, tabsAvailableToPin]);

    const tabById = useMemo(() => {
        const map = new Map<string, Tab>();
        for (const t of tabsData?.tabs ?? []) {
            map.set(t.id, t);
        }
        return map;
    }, [tabsData?.tabs]);

    const slots = useMemo(
        () => resolveTabBarLayout(prefs, TAB_BAR_KNOWN_IDS, homeDashboardId, knownTabIds),
        [prefs, homeDashboardId, knownTabIds],
    );

    // Keep a valid selection when slots change (and seed on first open)
    useEffect(() => {
        if (slots.length === 0) {
            setSelected(null);
            return;
        }
        setSelected(prev => {
            if (prev !== null && prev < slots.length) return prev;
            return initialSelectedIndex(prefs, homeDashboardId);
        });
    }, [slots.length, prefs, homeDashboardId]);
    const isDefault = prefsDeepEqual(prefs, defaultPrefs);
    const unusedActions = availableActions(prefs, TAB_BAR_ACTION_ORDER);
    const canAdd = slots.length < MAX_TAB_BAR_SLOTS;
    const selectedSlot = selected !== null ? slots[selected] : null;

    const apply = useCallback(
        async (next: MobileTabBarPrefs): Promise<void> => {
            const previous = prefs;
            setPrefs(next);
            if (selected !== null && selected >= next.slots.length) {
                setSelected(null);
            }
            try {
                await savePrefs(next);
            } catch {
                setPrefs(previous);
                showError('Save Failed', 'Could not save mobile tab bar layout.');
            }
        },
        [prefs, savePrefs, showError, selected],
    );

    const openLinkPanel = useCallback((state: LinkPanelState) => {
        setIframeTabPanel(null);
        setLinkPanel(state);
        if (state.mode === 'add') {
            setLinkFormData(DEFAULT_FORM_DATA);
            setSaveToLibrary(false);
            // Force From Dashboards to re-read saved widget configs (not stale RQ cache)
            void queryClient.invalidateQueries({ queryKey: queryKeys.widgets.all });
        } else {
            const slot = resolveTabBarLayout(prefs, TAB_BAR_KNOWN_IDS, homeDashboardId)[state.slotIndex];
            if (slot?.kind === 'link') {
                setLinkFormData(prefillLinkFormFromLink(slot.link));
            }
            setSaveToLibrary(false);
        }
        setLinkFormValid(true);
    }, [prefs, homeDashboardId, queryClient]);

    const closeLinkPanel = useCallback(() => {
        setLinkPanel(null);
    }, []);

    const openIframeTabPanel = useCallback((state: IframeTabPanelState) => {
        setLinkPanel(null);
        setIframeTabPanel(state);
    }, []);

    const closeIframeTabPanel = useCallback(() => {
        setIframeTabPanel(null);
    }, []);

    /** Select a preview slot and dismiss Add/Edit link or My Tab picker panels. */
    const selectSlot = useCallback((index: number | null) => {
        setLinkPanel(null);
        setIframeTabPanel(null);
        setSelected(index);
    }, []);

    const insertBeforeSettingsIndex = useCallback((): number => {
        const settingsIdx = prefs.slots.findIndex(s => s.kind === 'settings');
        return settingsIdx >= 0 ? settingsIdx : prefs.slots.length;
    }, [prefs.slots]);

    const handlePickIframeTab = useCallback(
        async (tabId: string): Promise<void> => {
            if (!iframeTabPanel) return;
            const slot: TabBarSlot = { kind: 'iframeTab', tabId };
            const insertAt = insertBeforeSettingsIndex();
            const next =
                iframeTabPanel.mode === 'add'
                    ? insertSlot(
                          prefs,
                          insertAt,
                          slot,
                          TAB_BAR_KNOWN_IDS,
                          homeDashboardId,
                          knownTabIds,
                      )
                    : replaceSlot(
                          prefs,
                          iframeTabPanel.slotIndex,
                          slot,
                          TAB_BAR_KNOWN_IDS,
                          homeDashboardId,
                          knownTabIds,
                      );
            await apply(next);
            closeIframeTabPanel();
        },
        [
            iframeTabPanel,
            insertBeforeSettingsIndex,
            prefs,
            homeDashboardId,
            knownTabIds,
            apply,
            closeIframeTabPanel,
        ],
    );

    const handleLinkPanelSave = useCallback(async (): Promise<void> => {
        if (!linkPanel) return;

        const link = buildLinkFromFormData(
            linkFormData,
            linkPanel.mode === 'edit' ? linkPanel.originalLinkId : undefined,
            { forceIconCaptionVisible: true },
        );

        if (saveToLibrary) {
            try {
                await linkLibraryApi.create(buildLibraryPayloadFromFormData(linkFormData));
                await queryClient.invalidateQueries({ queryKey: queryKeys.linkLibrary.list() });
            } catch {
                showError('Save Failed', 'Could not save to your link library.');
            }
        }

        const settingsIdx = prefs.slots.findIndex(s => s.kind === 'settings');
        const insertAt = settingsIdx >= 0 ? settingsIdx : prefs.slots.length;
        const next =
            linkPanel.mode === 'add'
                ? insertSlot(
                      prefs,
                      insertAt,
                      { kind: 'link', link },
                      TAB_BAR_KNOWN_IDS,
                      homeDashboardId,
                      knownTabIds,
                  )
                : replaceSlot(
                      prefs,
                      linkPanel.slotIndex,
                      { kind: 'link', link },
                      TAB_BAR_KNOWN_IDS,
                      homeDashboardId,
                      knownTabIds,
                  );

        await apply(next);
        closeLinkPanel();
    }, [
        linkPanel,
        linkFormData,
        saveToLibrary,
        prefs,
        apply,
        closeLinkPanel,
        queryClient,
        showError,
        homeDashboardId,
        knownTabIds,
    ]);

    const linkPrimaryDisabled =
        linkFormData.title.trim() === '' ||
        (linkFormData.type === 'link' && linkFormData.url.trim() === '') ||
        (linkFormData.type === 'action' && linkFormData.action.url.trim() === '') ||
        !linkFormValid;

    const eligibleLibraryLinks = useMemo(
        () => (libraryLinks as LibraryLink[]).filter(isTabBarEligibleLink),
        [libraryLinks],
    );

    const labelForDashboard = (dashboardId: string | null): string => {
        const id = dashboardId ?? homeDashboardId;
        if (!id) return 'Dashboard';
        return dashboards.find(d => d.id === id)?.name?.trim() || 'Dashboard';
    };

    const selectedTitle =
        selectedSlot == null
            ? null
            : selectedSlot.kind === 'menu'
              ? 'Menu'
              : selectedSlot.kind === 'settings'
                ? 'Settings'
                : selectedSlot.kind === 'dashboard'
                  ? 'Dashboard'
                  : selectedSlot.kind === 'link'
                    ? selectedSlot.link.title || 'Custom Link'
                    : selectedSlot.kind === 'iframeTab'
                      ? tabById.get(selectedSlot.tabId)?.name ?? 'My Tab'
                      : (TAB_BAR_ACTIONS[selectedSlot.actionId]?.label ?? 'Shortcut');

    return (
        <>
            <SettingsSection
                title="Layout"
                icon={Smartphone}
                description="Tap a button to select it, then rearrange or change what it opens. Menu, Settings, and at least one Dashboard are required."
                headerRight={
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={isDefault}
                        onClick={() => void apply(defaultPrefs)}
                    >
                        Reset
                    </Button>
                }
            >
                {/* Phone-framed preview */}
                <div className="mx-auto w-full max-w-sm">
                    <div className="rounded-[28px] border border-theme bg-theme-tertiary/40 p-3 shadow-inner">
                        <div className="mb-3 flex justify-center">
                            <div className="h-1 w-16 rounded-full bg-theme-tertiary" aria-hidden />
                        </div>
                        <div className="glass-card rounded-[20px] min-h-[70px] flex justify-around items-stretch gap-1 px-2 py-2">
                            {slots.map((slot, index) => {
                                const isSelected = selected === index;
                                const shell =
                                    'flex flex-col items-center justify-center gap-1 py-1.5 px-1.5 min-w-0 flex-1 rounded-xl border border-dashed transition-colors ' +
                                    (isSelected
                                        ? 'border-accent text-accent bg-accent/10'
                                        : 'border-theme/60 text-theme-tertiary hover:border-theme hover:text-theme-primary');

                                if (slot.kind === 'menu') {
                                    return (
                                        <button
                                            key={slotKey(slot, index)}
                                            type="button"
                                            className={shell}
                                            onClick={() => selectSlot(index)}
                                        >
                                            <Menu size={22} />
                                            <span className="text-[10px] font-medium truncate w-full text-center">
                                                Menu
                                            </span>
                                        </button>
                                    );
                                }

                                if (slot.kind === 'settings') {
                                    return (
                                        <button
                                            key={slotKey(slot, index)}
                                            type="button"
                                            className={shell}
                                            onClick={() => selectSlot(index)}
                                        >
                                            <Settings size={22} />
                                            <span className="text-[10px] font-medium truncate w-full text-center">
                                                Settings
                                            </span>
                                        </button>
                                    );
                                }

                                if (slot.kind === 'dashboard') {
                                    const name = labelForDashboard(slot.dashboardId);
                                    const dashId = slot.dashboardId ?? homeDashboardId;
                                    const dashIcon =
                                        dashboards.find(d => d.id === dashId)?.icon ||
                                        'LayoutDashboard';
                                    return (
                                        <button
                                            key={slotKey(slot, index)}
                                            type="button"
                                            className={shell}
                                            onClick={() => selectSlot(index)}
                                            title={name}
                                        >
                                            {renderIcon(dashIcon, 22)}
                                            <span className="text-[10px] font-medium truncate w-full text-center">
                                                {name}
                                            </span>
                                        </button>
                                    );
                                }

                                if (slot.kind === 'link') {
                                    const SlotIcon = getIconComponent(slot.link.icon);
                                    return (
                                        <button
                                            key={slotKey(slot, index)}
                                            type="button"
                                            className={shell}
                                            onClick={() => selectSlot(index)}
                                            title={slot.link.title}
                                        >
                                            <SlotIcon size={22} />
                                            <span className="text-[10px] font-medium truncate w-full text-center">
                                                {slot.link.title || 'Link'}
                                            </span>
                                        </button>
                                    );
                                }

                                if (slot.kind === 'iframeTab') {
                                    const tab = tabById.get(slot.tabId);
                                    const label = tab?.name?.trim() || 'My Tab';
                                    return (
                                        <button
                                            key={slotKey(slot, index)}
                                            type="button"
                                            className={shell}
                                            onClick={() => selectSlot(index)}
                                            title={label}
                                        >
                                            {tab ? renderIcon(tab.icon, 22) : <AppWindow size={22} />}
                                            <span className="text-[10px] font-medium truncate w-full text-center">
                                                {label}
                                            </span>
                                        </button>
                                    );
                                }

                                const def = TAB_BAR_ACTIONS[slot.actionId];
                                if (!def) return null;
                                const isActive = def.kind === 'navigate' ? def.isActive(hash) : false;
                                return (
                                    <button
                                        key={slotKey(slot, index)}
                                        type="button"
                                        className={
                                            shell + (isActive && !isSelected ? ' text-accent' : '')
                                        }
                                        onClick={() => selectSlot(index)}
                                    >
                                        {def.renderIcon({
                                            size: 22,
                                            isActive,
                                            currentUser,
                                            unreadCount,
                                        })}
                                        <span className="text-[10px] font-medium truncate w-full text-center">
                                            {def.label}
                                        </span>
                                    </button>
                                );
                            })}

                            {canAdd && (
                                <DropdownMenu>
                                    <DropdownMenu.Trigger asChild>
                                        <button
                                            type="button"
                                            className="flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl border border-dashed border-theme/60 text-theme-tertiary hover:border-accent hover:text-accent transition-colors shrink-0"
                                            aria-label="Add button"
                                        >
                                            <Plus size={20} />
                                            <span className="text-[10px] font-medium">Add</span>
                                        </button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content align="end">
                                        <DropdownMenu.Item
                                            onSelect={() =>
                                                void apply(
                                                    insertSlot(
                                                        prefs,
                                                        slots.length,
                                                        {
                                                            kind: 'dashboard',
                                                            dashboardId: homeDashboardId,
                                                        },
                                                        TAB_BAR_KNOWN_IDS,
                                                        homeDashboardId,
                                                        knownTabIds,
                                                    ),
                                                )
                                            }
                                        >
                                            <span className="flex items-center gap-2">
                                                <LayoutDashboard size={16} />
                                                Dashboard
                                            </span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            onSelect={() => openLinkPanel({ mode: 'add' })}
                                        >
                                            <span className="flex items-center gap-2">
                                                <LinkIcon size={16} />
                                                Custom Link
                                            </span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            onSelect={() => openIframeTabPanel({ mode: 'add' })}
                                        >
                                            <span className="flex items-center gap-2">
                                                <AppWindow size={16} />
                                                My Tab
                                            </span>
                                        </DropdownMenu.Item>
                                        {unusedActions.map(id => {
                                            const def = TAB_BAR_ACTIONS[id];
                                            if (!def) return null;
                                            return (
                                                <DropdownMenu.Item
                                                    key={id}
                                                    onSelect={() =>
                                                        void apply(
                                                            insertSlot(
                                                                prefs,
                                                                slots.length,
                                                                { kind: 'action', actionId: id },
                                                                TAB_BAR_KNOWN_IDS,
                                                                homeDashboardId,
                                                                knownTabIds,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    <span className="flex items-center gap-2">
                                                        {def.renderIcon({
                                                            size: 16,
                                                            isActive: false,
                                                            currentUser: null,
                                                            unreadCount: 0,
                                                        })}
                                                        {def.label}
                                                    </span>
                                                </DropdownMenu.Item>
                                            );
                                        })}
                                        {unusedActions.length === 0 && (
                                            <DropdownMenu.Item disabled>
                                                No more shortcuts available
                                            </DropdownMenu.Item>
                                        )}
                                    </DropdownMenu.Content>
                                </DropdownMenu>
                            )}
                        </div>
                        <p className="text-xs text-theme-tertiary text-center mt-3">
                            {slots.length} of {MAX_TAB_BAR_SLOTS} buttons
                            {selectedTitle ? ` · Editing ${selectedTitle}` : ' · Tap a button to edit'}
                        </p>
                    </div>
                </div>

                {linkPanel ? (
                    <div className="rounded-xl border border-theme bg-theme-secondary/30 p-4 space-y-4 max-w-sm mx-auto w-full">
                        <p className="text-sm font-medium text-theme-primary">
                            {linkPanel.mode === 'add' ? 'Add Custom Link' : 'Edit Custom Link'}
                        </p>

                        {linkPanel.mode === 'add' && (
                            <div className="flex flex-col gap-2 w-full">
                                {eligibleLibraryLinks.length > 0 && (
                                    <div className="w-full">
                                        <LinkSourceList
                                            items={eligibleLibraryLinks.map(l => ({
                                                ...l,
                                                subtitle: l.url,
                                            }))}
                                            triggerLabel="Saved Links"
                                            triggerIcon={BookOpen}
                                            countLabel={(n) => `${n} saved`}
                                            emptyLabel="No eligible saved links"
                                            searchPlaceholder="Search links..."
                                            onSelect={(l) => setLinkFormData(prefillLinkFormFromLink(l as Link))}
                                        />
                                    </div>
                                )}
                                <div className="w-full">
                                    <LinkSourceList
                                        items={harvestedLinks.map(h => ({
                                            ...h,
                                            // harvestKey is unique across cloned dashboards (widget link ids are not)
                                            id: h.harvestKey,
                                            subtitle: `${h.sourceDashboardName} → ${h.sourceWidgetTitle}`,
                                        }))}
                                        triggerLabel="From Dashboards"
                                        triggerIcon={LayoutDashboard}
                                        countLabel={(n) =>
                                            harvestLoading ? 'Scanning…' : `${n} found`
                                        }
                                        emptyLabel="No links found on dashboards"
                                        searchPlaceholder="Search harvested links..."
                                        onSelect={(item) => {
                                            const source = harvestedLinks.find(
                                                h => h.harvestKey === item.id,
                                            );
                                            if (source) {
                                                setLinkFormData(prefillLinkFormFromLink(source));
                                            }
                                        }}
                                        isLoading={harvestLoading}
                                        showWhenEmpty
                                    />
                                </div>
                            </div>
                        )}

                        <LinkFormFields
                            variant="tabBar"
                            formData={linkFormData}
                            setFormData={setLinkFormData}
                            onValidityChange={setLinkFormValid}
                        />

                        <label className="flex items-center gap-2 text-sm text-theme-secondary cursor-pointer">
                            <Checkbox
                                checked={saveToLibrary}
                                onCheckedChange={(checked) => setSaveToLibrary(checked === true)}
                                size="sm"
                            />
                            Also save to library
                        </label>

                        <div className="flex gap-2 justify-end">
                            <Button variant="secondary" size="md" onClick={closeLinkPanel}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                disabled={linkPrimaryDisabled}
                                onClick={() => void handleLinkPanelSave()}
                            >
                                {linkPanel.mode === 'add' ? 'Add to Tab Bar' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                ) : iframeTabPanel ? (
                    <div className="rounded-xl border border-theme bg-theme-secondary/30 p-4 space-y-3 max-w-sm mx-auto w-full">
                        <p className="text-sm font-medium text-theme-primary">
                            {iframeTabPanel.mode === 'add' ? 'Add My Tab' : 'My Tab shortcut'}
                        </p>
                        {tabsListLoading && (
                            <p className="text-sm text-theme-tertiary">Loading tabs…</p>
                        )}
                        {tabsListError && (
                            <p className="text-sm text-error">Could not load My Tabs.</p>
                        )}
                        {!tabsListLoading && !tabsListError && tabsForIframePicker.length === 0 && (
                            <p className="text-sm text-theme-secondary">
                                No tabs yet. Create one in Settings → My Tabs.
                            </p>
                        )}
                        {!tabsListLoading && tabsForIframePicker.length > 0 && (
                            <ul className="space-y-1 max-h-48 overflow-y-auto">
                                {tabsForIframePicker.map(tab => (
                                    <li key={tab.id}>
                                        <button
                                            type="button"
                                            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-theme-primary hover:bg-theme-hover text-left"
                                            onClick={() => void handlePickIframeTab(tab.id)}
                                        >
                                            {renderIcon(tab.icon, 18)}
                                            <span className="truncate">{tab.name}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex justify-end">
                            <Button variant="secondary" size="md" onClick={closeIframeTabPanel}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : selectedSlot && selected !== null ? (
                    <div className="rounded-xl border border-theme bg-theme-secondary/30 p-4 space-y-3 max-w-sm mx-auto w-full">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-theme-primary">{selectedTitle}</p>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    aria-label="Move left"
                                    disabled={selected === 0}
                                    onClick={() => {
                                        const next = moveSlot(prefs, selected, selected - 1);
                                        selectSlot(selected - 1);
                                        void apply(next);
                                    }}
                                    className="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-hover disabled:opacity-30"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Move right"
                                    disabled={selected >= slots.length - 1}
                                    onClick={() => {
                                        const next = moveSlot(prefs, selected, selected + 1);
                                        selectSlot(selected + 1);
                                        void apply(next);
                                    }}
                                    className="p-2 rounded-lg text-theme-tertiary hover:text-theme-primary hover:bg-theme-hover disabled:opacity-30"
                                >
                                    <ChevronRight size={18} />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Remove"
                                    disabled={!canRemoveSlot(prefs, selected)}
                                    onClick={() => {
                                        void apply(removeSlotAt(prefs, selected));
                                        selectSlot(null);
                                    }}
                                    className="p-2 rounded-lg text-theme-tertiary hover:text-error hover:bg-theme-hover disabled:opacity-30"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        {selectedSlot.kind === 'dashboard' && (
                            <div className="space-y-1.5">
                                <p className="text-xs text-theme-tertiary">Opens</p>
                                <DropdownMenu>
                                    <DropdownMenu.Trigger asChild>
                                        <button
                                            type="button"
                                            className="w-full flex items-center justify-between gap-2 rounded-lg border border-theme px-3 py-2 text-sm text-theme-primary hover:bg-theme-hover"
                                        >
                                            <span className="truncate text-left inline-flex items-center gap-1.5 min-w-0">
                                                <span className="truncate">
                                                    {labelForDashboard(selectedSlot.dashboardId)}
                                                </span>
                                                {homeDashboardId &&
                                                    (selectedSlot.dashboardId ?? homeDashboardId) ===
                                                        homeDashboardId && (
                                                        <Home
                                                            size={14}
                                                            className="text-accent shrink-0"
                                                            aria-label="Home"
                                                        />
                                                    )}
                                            </span>
                                            <ChevronDown
                                                size={16}
                                                className="shrink-0 text-theme-tertiary"
                                            />
                                        </button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content
                                        align="start"
                                        className="max-h-64 overflow-y-auto"
                                    >
                                        {dashboards.map(d => (
                                            <DropdownMenu.Item
                                                key={d.id}
                                                onSelect={() =>
                                                    void apply(
                                                        replaceSlot(
                                                            prefs,
                                                            selected,
                                                            {
                                                                kind: 'dashboard',
                                                                dashboardId: d.id,
                                                            },
                                                            TAB_BAR_KNOWN_IDS,
                                                            homeDashboardId,
                                                            knownTabIds,
                                                        ),
                                                    )
                                                }
                                            >
                                                <span className="flex items-center gap-1.5 min-w-0">
                                                    <span className="truncate">{d.name}</span>
                                                    {d.id === homeDashboardId && (
                                                        <Home
                                                            size={14}
                                                            className="text-accent shrink-0"
                                                            aria-label="Home"
                                                        />
                                                    )}
                                                </span>
                                            </DropdownMenu.Item>
                                        ))}
                                    </DropdownMenu.Content>
                                </DropdownMenu>
                            </div>
                        )}

                        {selectedSlot.kind === 'link' && (
                            <div className="space-y-2">
                                <p className="text-xs text-theme-tertiary">
                                    Custom link shortcut.
                                </p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                        openLinkPanel({
                                            mode: 'edit',
                                            slotIndex: selected,
                                            originalLinkId: selectedSlot.link.id,
                                        })
                                    }
                                >
                                    Edit
                                </Button>
                            </div>
                        )}

                        {selectedSlot.kind === 'iframeTab' && (
                            <div className="space-y-2">
                                <p className="text-xs text-theme-tertiary">
                                    Opens this My Tabs iframe. Label and icon come from Settings → My
                                    Tabs.
                                </p>
                                {(() => {
                                    const tab = tabById.get(selectedSlot.tabId);
                                    if (!tab || tab.enabled === false) {
                                        return (
                                            <p className="text-xs text-theme-secondary">
                                                Tab missing — remove or re-add.
                                            </p>
                                        );
                                    }
                                    return (
                                        <div className="flex items-center gap-2 text-sm text-theme-primary">
                                            {renderIcon(tab.icon, 18)}
                                            <span className="truncate">{tab.name}</span>
                                        </div>
                                    );
                                })()}
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                        openIframeTabPanel({ mode: 'edit', slotIndex: selected })
                                    }
                                >
                                    Change tab…
                                </Button>
                            </div>
                        )}

                        {(selectedSlot.kind === 'menu' || selectedSlot.kind === 'settings') && (
                            <p className="text-xs text-theme-tertiary">
                                Required — you can move it, but not remove it.
                            </p>
                        )}

                        {selectedSlot.kind === 'action' && (
                            <p className="text-xs text-theme-tertiary">
                                {TAB_BAR_ACTIONS[selectedSlot.actionId]?.settingsDescription}
                            </p>
                        )}
                    </div>
                ) : null}
            </SettingsSection>

            <SettingsSection title="Tips" icon={Info}>
                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <Hand size={18} className="text-accent shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-theme-primary">Hold to switch</p>
                            <p className="text-sm text-theme-secondary">
                                On your phone, press and hold a dashboard button to jump between
                                dashboards.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <LayoutDashboard size={18} className="text-accent shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-theme-primary">Dashboard icons</p>
                            <p className="text-sm text-theme-secondary">
                                Icons come from each dashboard under Settings → Dashboard. Change
                                them there to update the tab bar and desktop sidebar.
                            </p>
                        </div>
                    </div>
                </div>
            </SettingsSection>
        </>
    );
}

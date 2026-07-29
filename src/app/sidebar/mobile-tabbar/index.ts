export {
    TAB_BAR_ACTIONS,
    TAB_BAR_ACTION_ORDER,
    TAB_BAR_KNOWN_IDS,
    type TabBarActionDef,
    type TabBarActionRenderCtx,
    type TabBarInvokeCtx,
} from './tabBarActionRegistry';
export {
    MAX_TAB_BAR_SLOTS,
    MAX_CUSTOM_ACTIONS,
    DEFAULT_TAB_BAR_PREFS,
    createDefaultTabBarPrefs,
    sanitizeTabBarPrefs,
    resolveTabBarLayout,
    moveSlot,
    removeSlotAt,
    insertSlot,
    replaceSlot,
    canRemoveSlot,
    availableActions,
    countDashboardSlots,
    addCustomAction,
    removeCustomAction,
    moveCustomAction,
    countCustoms,
    prefsDeepEqual,
    type MobileTabBarPrefs,
    type TabBarSlot,
} from './tabBarLayout';
export { useMobileTabBarLayout } from './useMobileTabBarLayout';
export { TabBarActionButton } from './TabBarActionButton';
export { TabBarLinkButton, type TabBarLinkButtonProps } from './TabBarLinkButton';
export { TabBarIframeTabButton, type TabBarIframeTabButtonProps } from './TabBarIframeTabButton';
export {
    TabBarSelectionScope,
    TabBarSelectionTarget,
} from './TabBarSelectionIndicator';
export {
    resolveActiveTabBarSlotId,
    tabBarSlotKey,
} from './resolveActiveTabBarSlotId';
export {
    DashboardHoldSwitcher,
    type DashboardHoldSwitcherHandle,
    type HoldSwitcherCommit,
} from './DashboardHoldSwitcher';

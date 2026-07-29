export interface TabBarLayoutReadinessInput {
    configLoading: boolean;
    hasIframeTabSlot: boolean;
    tabsLoaded: boolean;
}

/**
 * Whether the tab bar's data-dependent slots are safe to measure.
 * Only waits on `tabsLoaded` when the saved prefs actually reference an
 * iframeTab (My Tab) slot — users without a pin see no added delay.
 */
export function computeTabBarLayoutReady({
    configLoading,
    hasIframeTabSlot,
    tabsLoaded,
}: TabBarLayoutReadinessInput): boolean {
    if (configLoading) return false;
    if (!hasIframeTabSlot) return true;
    return tabsLoaded;
}

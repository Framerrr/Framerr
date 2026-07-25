/** Whether the current hash is any dashboard route (including deep link). */
export function isAlreadyOnDashboardPage(): boolean {
    const h = window.location.hash;
    return !h || h === '#dashboard' || h.startsWith('#dashboard/');
}

/** Active tab detection from hash slice (no leading #). */
export function isDashboardHashActive(hash: string): boolean {
    return !hash || hash === 'dashboard' || hash.startsWith('dashboard/');
}

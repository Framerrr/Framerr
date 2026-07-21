/** Short month/day format shared by every release-pill consumer (e.g. "Jul 25"). */
export function formatDisplayDate(dateStr: string | null): string {
    if (!dateStr) return 'TBA';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

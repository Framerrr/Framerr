/**
 * Date Utilities
 *
 * Shared helpers for local-timezone-aware date formatting.
 * Uses browser's local timezone (from OS) — works on HTTP, no permissions needed.
 */

/**
 * Format a Date as 'YYYY-MM-DD' in the user's LOCAL timezone.
 *
 * IMPORTANT: Do NOT use `date.toISOString().split('T')[0]` — that converts to UTC
 * and produces the wrong date for users east of UTC after midnight local time.
 *
 * @example
 * // User in CET (UTC+1) at 11:30 PM on Feb 23:
 * new Date().toISOString().split('T')[0]  // ❌ "2026-02-24" (UTC = next day)
 * toLocalDateStr(new Date())              // ✅ "2026-02-23" (local = correct)
 */
export function toLocalDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

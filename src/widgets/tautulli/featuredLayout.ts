/**
 * Adaptive featured-band sizing for the Tautulli tab panels.
 *
 * Featured = non-scrolling 16:9 cards that evenly share width (0–3).
 * Remainder = compact ranked list underneath.
 *
 * Keeps heroes readable: drop into the list sooner rather than packing
 * 4–5 tiny cards across the band.
 * - 1–2 items → list only
 * - ≥4 items → always reserve ≥1 list row
 * - Width + count both cap N; final N = min of both
 */

export function featuredCount(totalItems: number, widthPx: number): number {
    if (totalItems <= 2) return 0;

    let widthCap = 1;
    if (widthPx >= 520) widthCap = 3;
    else if (widthPx >= 360) widthCap = 2;

    let countCap = 2;
    if (totalItems >= 6) countCap = 3;
    else if (totalItems >= 3) countCap = 2;

    let n = Math.min(3, widthCap, countCap, totalItems);

    // Keep the list meaningful when there's enough data
    if (totalItems >= 4) {
        n = Math.min(n, totalItems - 1);
    }

    return Math.max(0, n);
}

export function splitFeatured<T>(items: T[], widthPx: number): { featured: T[]; remainder: T[] } {
    const n = featuredCount(items.length, widthPx);
    return {
        featured: items.slice(0, n),
        remainder: items.slice(n),
    };
}

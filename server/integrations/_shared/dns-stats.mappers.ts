/**
 * Shared helpers for mapping AdGuard Home /control/stats list shapes.
 * AGH returns top_* as an array of single-key objects: [ { "host.or.ip": count }, ... ]
 */

export function mapAdGuardKeyedList(raw: unknown): Array<{ name: string; count: number }> {
    if (!Array.isArray(raw)) return [];

    const mapped: Array<{ name: string; count: number }> = [];

    for (const entry of raw.slice(0, 10)) {
        if (Array.isArray(entry) && entry.length >= 2) {
            const name = String(entry[0] ?? '');
            if (name) mapped.push({ name, count: Number(entry[1] ?? 0) });
            continue;
        }

        if (entry && typeof entry === 'object') {
            const obj = entry as Record<string, unknown>;
            if (typeof obj.domain === 'string') {
                mapped.push({ name: obj.domain, count: Number(obj.count ?? 0) });
                continue;
            }
            if (typeof obj.name === 'string') {
                mapped.push({ name: obj.name, count: Number(obj.count ?? 0) });
                continue;
            }

            const keys = Object.keys(obj);
            if (keys.length === 1) {
                const name = keys[0];
                if (name) mapped.push({ name, count: Number(obj[name] ?? 0) });
            }
        }
    }

    return mapped;
}

export function mapAdGuardTopBlocked(raw: unknown): Array<{ domain: string; count: number }> {
    return mapAdGuardKeyedList(raw).map((entry) => ({ domain: entry.name, count: entry.count }));
}

export function mapAdGuardSparkline(
    dnsQueries: unknown,
    blockedFiltering: unknown,
    timeUnits: unknown
): Array<{ timestamp: number; queries: number; blocked: number }> {
    if (!Array.isArray(dnsQueries)) return [];

    const queries = dnsQueries.map((v) => Number(v) || 0);
    const blocked = Array.isArray(blockedFiltering)
        ? blockedFiltering.map((v) => Number(v) || 0)
        : queries.map(() => 0);

    const len = Math.min(queries.length, blocked.length);
    if (len === 0) return [];

    const unitMs = timeUnits === 'days' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const now = Date.now();
    // Keep last 24 points max for widget sparklines
    const start = Math.max(0, len - 24);
    const points: Array<{ timestamp: number; queries: number; blocked: number }> = [];

    for (let i = start; i < len; i++) {
        const offsetFromEnd = len - 1 - i;
        points.push({
            timestamp: now - offsetFromEnd * unitMs,
            queries: queries[i],
            blocked: blocked[i] ?? 0,
        });
    }

    return points;
}

export function mapAdGuardUpstreams(
    responses: unknown,
    avgTimes: unknown
): Array<{ name: string; count: number; avgResponseMs: number | null }> {
    const responseList = mapAdGuardKeyedList(responses);
    const avgMap = new Map<string, number>();

    for (const entry of mapAdGuardKeyedList(avgTimes)) {
        // AGH avg time is typically seconds as float
        const ms = entry.count < 10 ? entry.count * 1000 : entry.count;
        avgMap.set(entry.name, ms);
    }

    return responseList.map((entry) => ({
        name: entry.name,
        count: entry.count,
        avgResponseMs: avgMap.has(entry.name) ? avgMap.get(entry.name)! : null,
    }));
}

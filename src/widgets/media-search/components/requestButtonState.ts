import type { RequestButtonState, OverseerrMediaResult } from '../types';

/**
 * Determine initial button state from Overseerr mediaInfo
 */
export function getInitialRequestState(item: OverseerrMediaResult): RequestButtonState {
    if (!item.mediaInfo) return 'idle';

    const { status, requestedSeasonCount, totalSeasonCount } = item.mediaInfo;

    // TV shows: use enriched per-season counts for accuracy
    if (item.mediaType === 'tv') {
        if (status === 5) return 'available';
        // If backend provided season counts, check if ALL seasons are covered
        if (requestedSeasonCount !== undefined && totalSeasonCount !== undefined && totalSeasonCount > 0) {
            if (requestedSeasonCount >= totalSeasonCount) return 'requested';
        }
        // Partial or unknown — keep button active for more requests
        return 'idle';
    }

    // Movies: standard behavior
    switch (status) {
        case 2: // Pending
        case 3: // Processing
            return 'requested';
        case 5: // Available
            return 'available';
        default:
            return 'idle';
    }
}

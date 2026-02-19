/**
 * RequestButton Component
 * 
 * Inline request button for Overseerr media results.
 * Uses a state machine matching the LinkGrid pattern:
 * 
 *   [idle] → click → [loading] → success → [success ✓] → permanent [Requested]
 *                               → fail    → [error ✗]  → 1s → [idle] (retry)
 * 
 * All states use the <Button> primitive for consistent sizing and rounding.
 * Non-idle states display as disabled buttons with status-appropriate colors.
 */

import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../../../shared/ui';
import type { RequestButtonState, OverseerrMediaResult } from '../types';
import type { OverseerrServers } from '../hooks/useOverseerrRequest';

interface RequestButtonProps {
    state: RequestButtonState;
    onClick: () => void;
    className?: string;
}

/**
 * Stateful request button — renders the Button primitive for every state.
 * The parent owns the state machine; this component is purely presentational.
 */
export function RequestButton({ state, onClick, className = '' }: RequestButtonProps) {
    switch (state) {
        case 'loading':
            return (
                <Button
                    variant="primary"
                    size="sm"
                    textSize="sm"
                    disabled
                    loading
                    className={`media-search-request-btn ${className}`}
                />
            );

        case 'success':
            return (
                <Button
                    variant="secondary"
                    size="sm"
                    textSize="sm"
                    disabled
                    icon={CheckCircle2}
                    customColor={{ background: 'var(--success)', text: '#fff' }}
                    className={`media-search-request-btn ${className}`}
                >
                    Requested
                </Button>
            );

        case 'error':
            return (
                <Button
                    variant="secondary"
                    size="sm"
                    textSize="sm"
                    disabled
                    icon={XCircle}
                    customColor={{ background: 'var(--error)', text: '#fff' }}
                    className={`media-search-request-btn ${className}`}
                >
                    Failed
                </Button>
            );

        case 'requested':
            return (
                <Button
                    variant="secondary"
                    size="sm"
                    textSize="sm"
                    disabled
                    icon={CheckCircle2}
                    customColor={{ background: 'var(--warning)', text: '#fff' }}
                    className={`media-search-request-btn ${className}`}
                >
                    Requested
                </Button>
            );

        case 'available':
            return (
                <Button
                    variant="secondary"
                    size="sm"
                    textSize="sm"
                    disabled
                    customColor={{ background: 'var(--success)', text: '#fff' }}
                    className={`media-search-request-btn ${className}`}
                >
                    Available
                </Button>
            );

        case 'idle':
        default:
            return (
                <Button
                    variant="primary"
                    size="sm"
                    textSize="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                    className={`media-search-request-btn ${className}`}
                >
                    Request
                </Button>
            );
    }
}

// ============================================================================
// HELPER: Determine initial button state from Overseerr mediaInfo
// ============================================================================

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

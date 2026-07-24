/**
 * useAutoSearchState - Shared idle → searching → success/error → idle state
 * machine for "trigger an automatic search" actions.
 *
 * Used by both MovieDetailModal's footer button and the Needs Attention
 * row's inline Search button so they share identical timing/visuals instead
 * of maintaining two copies of the same transient-state logic.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoSearchState = 'idle' | 'searching' | 'success' | 'error';

interface UseAutoSearchStateOpts {
    /** How long the success state lingers before reverting to idle. */
    successDurationMs?: number;
    /** How long the error state lingers before reverting to idle. */
    errorDurationMs?: number;
    /** Floor on how long the "searching" spinner shows, even if the request resolves faster — otherwise a fast response reads as a non-event. */
    minSearchingDurationMs?: number;
}

export function useAutoSearchState({
    successDurationMs = 2500,
    errorDurationMs = 3000,
    minSearchingDurationMs = 1500,
}: UseAutoSearchStateOpts = {}) {
    const [state, setState] = useState<AutoSearchState>('idle');
    // Read inside `trigger` without recreating the callback on every state tick.
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    /** Clears any pending revert timer and snaps back to idle immediately. */
    const reset = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setState('idle');
    }, []);

    /** Runs `action`, transitioning through searching → success/error → idle.
     * The spinner holds for at least `minSearchingDurationMs` even if the
     * request itself resolves faster, so a fast response doesn't flash by
     * unnoticed. */
    const trigger = useCallback(async (action: () => Promise<boolean>) => {
        if (stateRef.current === 'searching') return;
        if (timerRef.current) clearTimeout(timerRef.current);

        setState('searching');
        const minDelay = new Promise<void>(resolve => setTimeout(resolve, minSearchingDurationMs));
        const [success] = await Promise.all([action(), minDelay]);

        if (success) {
            setState('success');
            timerRef.current = setTimeout(() => setState('idle'), successDurationMs);
        } else {
            setState('error');
            timerRef.current = setTimeout(() => setState('idle'), errorDurationMs);
        }
    }, [successDurationMs, errorDurationMs, minSearchingDurationMs]);

    return { state, trigger, reset };
}

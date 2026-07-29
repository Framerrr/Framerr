/**
 * FRAMERR: Suppresses the native browser `click` that fires immediately
 * after a real mouse drag-and-drop completes on a GridStack widget.
 *
 * Arm on dragstart with a sticky flag (NOT a short absolute timeout — that
 * expired mid-drag and let the post-drop click through). On dragstop, switch
 * to a short post-drop window. Resolve targets to `.grid-stack-item` so React
 * remounts of tile children don't break identity checks.
 *
 * Also installs a capture-phase document click listener so the trailing click
 * is stopped even if a React remount races the bubble handler.
 */

const SUPPRESSION_WINDOW_MS = 200;

let armedUntil = 0;
let armedGridItemEl: Element | null = null;
let captureClickHandler: ((e: MouseEvent) => void) | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function resolveGridItem(el: Element | null | undefined): Element | null {
    if (!el || !(el instanceof Element)) return null;
    return el.closest('.grid-stack-item');
}

function clearExpiryTimer(): void {
    if (expiryTimer != null) {
        clearTimeout(expiryTimer);
        expiryTimer = null;
    }
}

function disarmCaptureClick(): void {
    if (captureClickHandler) {
        document.removeEventListener('click', captureClickHandler, true);
        captureClickHandler = null;
    }
}

function armCaptureClick(): void {
    disarmCaptureClick();
    captureClickHandler = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (!consumeGridDragSuppression(target)) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    };
    document.addEventListener('click', captureClickHandler, true);
}

/** Call from GridStack 'dragstart' — sticky arm for the entire drag. */
export function markGridDragStarted(gridItemEl: Element | null): void {
    const item = resolveGridItem(gridItemEl) ?? gridItemEl;
    armedGridItemEl = item;
    armedUntil = Number.POSITIVE_INFINITY;
    clearExpiryTimer();
    armCaptureClick();
}

/** Call from GridStack 'dragstop' — start the short post-drop click window. */
export function markGridDragStopped(gridItemEl: Element | null): void {
    const item = resolveGridItem(gridItemEl) ?? gridItemEl;
    armedGridItemEl = item;
    armedUntil = Date.now() + SUPPRESSION_WINDOW_MS;
    clearExpiryTimer();
    armCaptureClick();
    expiryTimer = setTimeout(() => {
        armedUntil = 0;
        armedGridItemEl = null;
        disarmCaptureClick();
        expiryTimer = null;
    }, SUPPRESSION_WINDOW_MS + 50);
}

/**
 * Returns true (and consumes the flag) if a real drag on the grid item
 * containing `originEl` is/was armed.
 */
export function consumeGridDragSuppression(originEl: Element | null): boolean {
    if (!armedGridItemEl) return false;
    if (Number.isFinite(armedUntil) && Date.now() >= armedUntil) {
        armedGridItemEl = null;
        armedUntil = 0;
        clearExpiryTimer();
        disarmCaptureClick();
        return false;
    }
    const originItem = resolveGridItem(originEl);
    const sameWidget =
        !!originEl &&
        (armedGridItemEl === originEl ||
            armedGridItemEl.contains(originEl) ||
            (!!originItem && originItem === armedGridItemEl));
    if (sameWidget) {
        armedUntil = 0;
        armedGridItemEl = null;
        clearExpiryTimer();
        disarmCaptureClick();
    }
    return sameWidget;
}

/** Test-only reset — keeps suite isolation without exporting internal state. */
export function __resetGridDragSuppressionForTests(): void {
    armedUntil = 0;
    armedGridItemEl = null;
    clearExpiryTimer();
    disarmCaptureClick();
}

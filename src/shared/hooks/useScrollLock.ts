import { useLayoutEffect, useRef } from 'react';

/**
 * useScrollLock - Prevents page scrolling when modal/overlay is open
 *
 * Framerr / iOS notes:
 * - Do NOT set `position: fixed` on body. `src/index.css` documents that it
 *   fights `viewport-fit=cover` and shifts content (safe-area / home indicator).
 * - Dashboard/settings scroll inside `#dashboard-layer` / `#settings-layer`,
 *   not `window`. Those layers are frozen for the lock duration.
 * - Match SidebarUIContext: overflow + overscroll + touchmove lock.
 *
 * Scroll-in-scroll support:
 * - Allows scrolling within nested overflow:auto/scroll containers
 * - Clamps at scroll boundaries to prevent page overscroll
 * - Page layers themselves are never treated as allowed scroll targets
 *
 * Usage:
 * useScrollLock(isModalOpen);
 */

/** Keep-alive page layers that own real scroll (see MainContent PageLayer) */
const PAGE_SCROLL_LAYER_IDS = ['dashboard-layer', 'settings-layer'] as const;

type FrozenLayer = {
    el: HTMLElement;
    scrollTop: number;
    overflowY: string;
};

type StyleSnapshot = {
    overflow: string;
    overscrollBehavior: string;
    touchAction: string;
};

export function useScrollLock(isLocked: boolean) {
    const frozenLayersRef = useRef<FrozenLayer[]>([]);

    // Layout effect so page layers freeze before child useEffects focus inputs.
    useLayoutEffect(() => {
        if (!isLocked) return;

        const html = document.documentElement;
        const body = document.body;

        const prevHtml: StyleSnapshot = {
            overflow: html.style.overflow,
            overscrollBehavior: html.style.overscrollBehavior,
            touchAction: html.style.touchAction,
        };
        const prevBody: StyleSnapshot = {
            overflow: body.style.overflow,
            overscrollBehavior: body.style.overscrollBehavior,
            touchAction: body.style.touchAction,
        };

        // Freeze app page layers (dashboard scrolls here, not on window)
        const frozen: FrozenLayer[] = [];
        for (const id of PAGE_SCROLL_LAYER_IDS) {
            const el = document.getElementById(id);
            if (!el) continue;
            const scrollTop = el.scrollTop;
            frozen.push({
                el,
                scrollTop,
                overflowY: el.style.overflowY,
            });
            el.style.overflowY = 'hidden';
            el.scrollTop = scrollTop;
        }
        frozenLayersRef.current = frozen;

        const pinLayerScroll = () => {
            for (const layer of frozenLayersRef.current) {
                if (layer.el.scrollTop !== layer.scrollTop) {
                    layer.el.scrollTop = layer.scrollTop;
                }
            }
        };

        // Sidebar-style lock — never position:fixed on body (viewport-fit fight)
        html.style.overflow = 'hidden';
        html.style.overscrollBehavior = 'none';
        body.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';
        body.style.touchAction = 'none';

        let touchStartY = 0;

        const handleTouchStart = (e: TouchEvent) => {
            touchStartY = e.touches[0].clientY;
        };

        const handleTouchMove = (e: TouchEvent) => {
            const target = e.target as HTMLElement;
            if (!target) return;

            const scrollable = findScrollableAncestor(target);

            if (scrollable) {
                const { scrollTop, scrollHeight, clientHeight } = scrollable;
                const touchY = e.touches[0].clientY;
                const deltaY = touchStartY - touchY;
                const isScrollingDown = deltaY > 0;
                const isScrollingUp = deltaY < 0;

                const atTop = scrollTop <= 0 && isScrollingUp;
                const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && isScrollingDown;

                if (atTop || atBottom) {
                    e.preventDefault();
                }
            } else {
                e.preventDefault();
            }
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('scroll', pinLayerScroll, true);

        return () => {
            html.style.overflow = prevHtml.overflow;
            html.style.overscrollBehavior = prevHtml.overscrollBehavior;
            html.style.touchAction = prevHtml.touchAction;
            body.style.overflow = prevBody.overflow;
            body.style.overscrollBehavior = prevBody.overscrollBehavior;
            body.style.touchAction = prevBody.touchAction;

            for (const layer of frozenLayersRef.current) {
                layer.el.style.overflowY = layer.overflowY;
                layer.el.scrollTop = layer.scrollTop;
            }
            frozenLayersRef.current = [];

            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('scroll', pinLayerScroll, true);
        };
    }, [isLocked]);
}

/**
 * Walk up from element to find the nearest scrollable ancestor.
 * Stops at body. Skips keep-alive page layers (frozen separately).
 */
function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
        if ((PAGE_SCROLL_LAYER_IDS as readonly string[]).includes(current.id)) {
            return null;
        }

        if (current.scrollHeight > current.clientHeight) {
            const overflow = getComputedStyle(current).overflowY;
            if (overflow === 'auto' || overflow === 'scroll') {
                return current;
            }
        }
        current = current.parentElement;
    }

    return null;
}

export default useScrollLock;

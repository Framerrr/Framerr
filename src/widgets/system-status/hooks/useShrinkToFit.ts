import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Measures the unscaled content of `containerRef`'s children against the
 * container's available box and returns a uniform scale factor so the
 * content fits without clipping. Re-measures on ResizeObserver + deps.
 */
export function useShrinkToFit(
    containerRef: RefObject<HTMLElement | null>,
    deps: unknown[],
    min = 0.72,
): number {
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const fit = () => {
            const availableW = el.clientWidth;
            const availableH = el.clientHeight;
            if (availableW <= 0 || availableH <= 0) {
                setScale(1);
                return;
            }

            el.style.transform = 'scale(1)';

            const contentW = Math.max(
                ...Array.from(el.children, (child) => (child as HTMLElement).scrollWidth),
                1
            );
            const contentH = Array.from(el.children).reduce(
                (sum, child) => sum + (child as HTMLElement).offsetHeight,
                0
            );
            const rowGap =
                el.children.length > 1
                    ? Number.parseFloat(getComputedStyle(el).rowGap || getComputedStyle(el).gap) || 0
                    : 0;
            const totalH = contentH + rowGap;

            const nextScale = Math.min(1, availableW / contentW, availableH / Math.max(totalH, 1));
            const clamped = Math.max(min, Number.isFinite(nextScale) ? nextScale : 1);
            setScale(clamped);
            el.style.transform = `scale(${clamped})`;
        };

        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return scale;
}

/**
 * Single persistent selection pill for the mobile bottom tab bar.
 *
 * Measures the active slot and springs left/width/top/height — avoids Framer
 * shared `layoutId` remount gaps that made the indicator hitch between tabs.
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useLayoutEffect,
    useReducer,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { AnimatePresence, motion, useSpring } from 'framer-motion';

const INDICATOR_CLASS =
    'rounded-xl bg-accent/20 shadow-sm pointer-events-none';

/** Match prior per-slot inset: top -2px / bottom 2px (same height, shifted up 2px). */
const TOP_OFFSET_PX = -2;

const springConfig = {
    stiffness: 300,
    damping: 38,
    mass: 1,
};

type Bounds = { top: number; left: number; width: number; height: number };

type TabBarSelectionContextValue = {
    registerTarget: (id: string, el: HTMLElement) => () => void;
};

const TabBarSelectionContext = createContext<TabBarSelectionContextValue | null>(null);

function targetsEqual(a: Bounds, b: Bounds): boolean {
    return (
        Math.abs(a.top - b.top) <= 0.5 &&
        Math.abs(a.left - b.left) <= 0.5 &&
        Math.abs(a.width - b.width) <= 0.5 &&
        Math.abs(a.height - b.height) <= 0.5
    );
}

export interface TabBarSelectionScopeProps {
    activeId: string | null;
    /**
     * When true, drop the last measured geometry so the next `activeId` snaps
     * instead of springing from a ghost position (unbound multi-dashboard).
     */
    resetSelectionAnchor?: boolean;
    className?: string;
    children: ReactNode;
}

export function TabBarSelectionScope({
    activeId,
    resetSelectionAnchor = false,
    className = '',
    children,
}: TabBarSelectionScopeProps): React.JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemsRef = useRef(new Map<string, HTMLElement>());
    const [registryVersion, bumpRegistry] = useReducer((x: number) => x + 1, 0);
    const [hasTarget, setHasTarget] = useState(false);
    const lastTargetRef = useRef<Bounds | null>(null);
    const prevActiveIdRef = useRef<string | null>(null);

    const top = useSpring(0, springConfig);
    const left = useSpring(0, springConfig);
    const width = useSpring(0, springConfig);
    const height = useSpring(0, springConfig);

    const registerTarget = useCallback((id: string, el: HTMLElement) => {
        itemsRef.current.set(id, el);
        bumpRegistry();
        return () => {
            const current = itemsRef.current.get(id);
            if (current === el) {
                itemsRef.current.delete(id);
                bumpRegistry();
            }
        };
    }, []);

    const measure = useCallback((el: HTMLElement): Bounds => {
        const container = containerRef.current;
        if (!container) {
            return { top: 0, left: 0, width: 0, height: 0 };
        }
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const scaleX = containerRect.width / (container.offsetWidth || 1) || 1;
        const scaleY = containerRect.height / (container.offsetHeight || 1) || 1;
        return {
            top: (elRect.top - containerRect.top) / scaleY + TOP_OFFSET_PX,
            left: (elRect.left - containerRect.left) / scaleX,
            width: elRect.width / scaleX,
            height: elRect.height / scaleY,
        };
    }, []);

    const retarget = useCallback(
        (el: HTMLElement, snap: boolean) => {
            const next = measure(el);
            const last = lastTargetRef.current;
            if (last && targetsEqual(last, next)) return;
            if (snap) {
                top.jump(next.top);
                left.jump(next.left);
                width.jump(next.width);
                height.jump(next.height);
            } else {
                top.set(next.top);
                left.set(next.left);
                width.set(next.width);
                height.set(next.height);
            }
            lastTargetRef.current = next;
        },
        [measure, top, left, width, height],
    );

    // Unbound dashboard (no bar slot): forget last geometry while the pill is
    // hidden so the next real slot (Settings, My Tab, …) snaps on, not from
    // the stale bound-dashboard position.
    useLayoutEffect(() => {
        if (resetSelectionAnchor) {
            lastTargetRef.current = null;
            prevActiveIdRef.current = null;
        }
    }, [resetSelectionAnchor]);

    useLayoutEffect(() => {
        if (!activeId) {
            prevActiveIdRef.current = null;
            setHasTarget(false);
            return;
        }

        const el = itemsRef.current.get(activeId);
        if (!el) {
            prevActiveIdRef.current = null;
            setHasTarget(false);
            return;
        }

        // Snap only for a true first measurement, or when the previously active
        // target vanished from the registry (sibling layout correction). A
        // transient activeId gap (e.g. a brief null during route/hash churn)
        // must not force a snap on reappearance — it springs from the last
        // known position instead. Unbound-dashboard clears lastTarget via
        // resetSelectionAnchor so the next show snaps correctly.
        const snap =
            lastTargetRef.current === null ||
            (prevActiveIdRef.current !== null &&
                !itemsRef.current.has(prevActiveIdRef.current));

        retarget(el, snap);
        prevActiveIdRef.current = activeId;
        setHasTarget(true);
    }, [activeId, registryVersion, retarget]);

    // Keep geometry correct if a slot resizes (label/icon changes).
    useLayoutEffect(() => {
        if (!activeId || !hasTarget) return;
        const el = itemsRef.current.get(activeId);
        if (!el) return;

        const observer = new ResizeObserver(() => {
            retarget(el, true);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [activeId, hasTarget, retarget]);

    const ctx = React.useMemo(() => ({ registerTarget }), [registerTarget]);

    return (
        <TabBarSelectionContext.Provider value={ctx}>
            <div ref={containerRef} className={`relative ${className}`.trim()}>
                <AnimatePresence>
                    {hasTarget && (
                        <motion.div
                            key="tab-bar-selection"
                            className={`absolute ${INDICATOR_CLASS}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                top,
                                left,
                                width,
                                height,
                                zIndex: 0,
                            }}
                        />
                    )}
                </AnimatePresence>
                {children}
            </div>
        </TabBarSelectionContext.Provider>
    );
}

export interface TabBarSelectionTargetProps {
    id: string;
    className?: string;
    children: ReactNode;
}

export function TabBarSelectionTarget({
    id,
    className = '',
    children,
}: TabBarSelectionTargetProps): React.JSX.Element {
    const ctx = useContext(TabBarSelectionContext);
    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!ctx || !ref.current) return;
        return ctx.registerTarget(id, ref.current);
    }, [ctx, id]);

    return (
        <div ref={ref} className={`relative z-[1] ${className}`.trim()}>
            {children}
        </div>
    );
}

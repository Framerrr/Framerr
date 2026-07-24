import { useContext, useEffect, useRef } from 'react';
import { SettingsAnimationContext } from './SettingsAnimationContext';

interface SettingsAnimationContextType {
    skipAnimation: boolean;
    markRendered: (category: string) => void;
    hasRendered: (category: string) => boolean;
}

export function useSettingsAnimation(): SettingsAnimationContextType {
    const context = useContext(SettingsAnimationContext);
    if (!context) {
        return {
            skipAnimation: false,
            markRendered: () => { },
            hasRendered: () => false,
        };
    }
    return context;
}

/**
 * Hook for settings pages to get animation class
 */
export function useSettingsAnimationClass(categoryId: string): string {
    const { hasRendered, markRendered } = useSettingsAnimation();
    const isFirstRender = useRef(!hasRendered(categoryId));

    useEffect(() => {
        markRendered(categoryId);
    }, [categoryId, markRendered]);

    // Intentional ref read on render — preserves first-render-only animation class (moved from SettingsAnimationContext.tsx)
    // eslint-disable-next-line react-hooks/refs -- stable first-render animation gate; ref only written in effect
    return isFirstRender.current ? 'fade-in' : '';
}

/**
 * Hook for shared components to know if they should animate
 */
export function useShouldAnimate(categoryId: string): boolean {
    const { hasRendered, markRendered } = useSettingsAnimation();
    const shouldAnimate = useRef(!hasRendered(categoryId));

    useEffect(() => {
        markRendered(categoryId);
    }, [categoryId, markRendered]);

    // Intentional ref read on render — preserves first-render-only animation gate (moved from SettingsAnimationContext.tsx)
    // eslint-disable-next-line react-hooks/refs -- stable first-render animation gate; ref only written in effect
    return shouldAnimate.current;
}

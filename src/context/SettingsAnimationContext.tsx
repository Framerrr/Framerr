/**
 * SettingsAnimationContext
 * 
 * Provides information about whether settings pages should animate.
 * With keep-alive architecture, pages should only animate on:
 * - First ever render (initial mount)
 * - Navigation within settings (category change)
 * 
 * NOT when:
 * - Page is just being revealed (returning from Dashboard)
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

interface SettingsAnimationContextType {
    /** If true, internal animations should be skipped */
    skipAnimation: boolean;
    /** Mark this category as having been rendered */
    markRendered: (category: string) => void;
    /** Check if a category has been rendered before */
    hasRendered: (category: string) => boolean;
}

const SettingsAnimationContext = createContext<SettingsAnimationContextType | null>(null);

interface SettingsAnimationProviderProps {
    children: ReactNode;
}

export function SettingsAnimationProvider({ children }: SettingsAnimationProviderProps): React.JSX.Element {
    // Track which categories have been rendered
    const renderedCategories = useRef<Set<string>>(new Set());

    // Track if we're in a "reveal" state (coming back to settings)
    const [skipAnimation, setSkipAnimation] = useState(false);
    const hasEverRendered = useRef(false);

    useEffect(() => {
        // After first render, subsequent renders are "reveals"
        if (hasEverRendered.current) {
            setSkipAnimation(true);
        } else {
            hasEverRendered.current = true;
        }
    }, []);

    const markRendered = (category: string): void => {
        renderedCategories.current.add(category);
    };

    const hasRendered = (category: string): boolean => {
        return renderedCategories.current.has(category);
    };

    return (
        <SettingsAnimationContext.Provider value={{ skipAnimation, markRendered, hasRendered }}>
            {children}
        </SettingsAnimationContext.Provider>
    );
}

export function useSettingsAnimation(): SettingsAnimationContextType {
    const context = useContext(SettingsAnimationContext);
    if (!context) {
        // Default behavior when outside context - always animate
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
 * Usage: const animClass = useSettingsAnimationClass('tabs');
 * Then: <div className={`${animClass} ...`}>
 */
export function useSettingsAnimationClass(categoryId: string): string {
    const { hasRendered, markRendered } = useSettingsAnimation();
    const isFirstRender = useRef(!hasRendered(categoryId));

    useEffect(() => {
        markRendered(categoryId);
    }, [categoryId, markRendered]);

    // Only return animation class on first render
    return isFirstRender.current ? 'fade-in' : '';
}

/**
 * Hook for shared components (SettingsPage, SettingsSection) to know if they should animate
 * Returns true if this is the first render of the category, false if already rendered (reveal)
 * 
 * Usage:
 * const shouldAnimate = useShouldAnimate('integrations');
 * <SettingsPage noAnimation={!shouldAnimate} ...>
 */
export function useShouldAnimate(categoryId: string): boolean {
    const { hasRendered, markRendered } = useSettingsAnimation();
    const shouldAnimate = useRef(!hasRendered(categoryId));

    useEffect(() => {
        markRendered(categoryId);
    }, [categoryId, markRendered]);

    return shouldAnimate.current;
}

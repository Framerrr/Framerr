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

import React, { createContext, useRef, ReactNode } from 'react';

interface SettingsAnimationContextType {
    /** If true, internal animations should be skipped */
    skipAnimation: boolean;
    /** Mark this category as having been rendered */
    markRendered: (category: string) => void;
    /** Check if a category has been rendered before */
    hasRendered: (category: string) => boolean;
}

const SettingsAnimationContext = createContext<SettingsAnimationContextType | null>(null);

export { SettingsAnimationContext };

interface SettingsAnimationProviderProps {
    children: ReactNode;
}

export function SettingsAnimationProvider({ children }: SettingsAnimationProviderProps): React.JSX.Element {
    // Track which categories have been rendered
    const renderedCategories = useRef<Set<string>>(new Set());

    // Track if we're in a "reveal" state (coming back to settings)
    // Using a ref instead of state to avoid set-state-in-effect
    const skipAnimationRef = useRef(false);
    const hasEverRendered = useRef(false);

    // After first render, subsequent renders are "reveals"
    // Set the ref synchronously — no effect needed
    if (hasEverRendered.current) {
        skipAnimationRef.current = true;
    } else {
        hasEverRendered.current = true;
    }

    const markRendered = (category: string): void => {
        renderedCategories.current.add(category);
    };

    const hasRendered = (category: string): boolean => {
        return renderedCategories.current.has(category);
    };

    return (
        <SettingsAnimationContext.Provider value={{ skipAnimation: skipAnimationRef.current, markRendered, hasRendered }}>
            {children}
        </SettingsAnimationContext.Provider>
    );
}

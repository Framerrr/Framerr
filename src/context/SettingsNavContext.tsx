import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { getSegmentLabels } from '../components/sidebar/settingsMenuConfig';

/**
 * SettingsNavContext - Navigation state for iOS-style settings
 * 
 * Manages the current path within settings, animation direction,
 * and provides navigation functions (navigate, goBack).
 * 
 * URL Format: #settings/category/subcategory
 * Example: #settings/customization/general
 */

// Types
export interface SettingsNavPath {
    /** Full path segments, e.g. ['customization', 'general'] */
    segments: string[];
    /** Query params from URL, e.g. { source: 'profile' } */
    params: Record<string, string>;
}

export type AnimationDirection = 'forward' | 'backward' | 'none';

export interface SettingsNavContextValue {
    /** Current navigation path */
    path: SettingsNavPath;
    /** Animation direction for transitions */
    animationDirection: AnimationDirection;
    /** Navigate to a new path (forward) */
    navigate: (path: string) => void;
    /** Go back one level */
    goBack: () => void;
    /** Go to root settings */
    goToRoot: () => void;
    /** Check if we can go back (not at root) */
    canGoBack: boolean;
    /** Get current depth (0 = root, 1 = category, 2 = subcategory) */
    depth: number;
    /** Get breadcrumb labels */
    getBreadcrumbs: () => string[];
}

const defaultPath: SettingsNavPath = {
    segments: [],
    params: {}
};

const defaultValue: SettingsNavContextValue = {
    path: defaultPath,
    animationDirection: 'none',
    navigate: () => { },
    goBack: () => { },
    goToRoot: () => { },
    canGoBack: false,
    depth: 0,
    getBreadcrumbs: () => []
};

const SettingsNavContext = createContext<SettingsNavContextValue>(defaultValue);

/**
 * Parse hash URL into path segments and params
 * e.g., "#settings/customization/general?source=profile"
 * => { segments: ['customization', 'general'], params: { source: 'profile' } }
 */
function parseHash(hash: string): SettingsNavPath {
    // Remove leading # if present
    const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;

    // Split path and query
    const [pathPart, queryPart] = cleanHash.split('?');

    // Get segments after "settings/"
    const segments: string[] = [];
    if (pathPart.startsWith('settings/')) {
        const rest = pathPart.slice('settings/'.length);
        if (rest) {
            segments.push(...rest.split('/').filter(Boolean));
        }
    } else if (pathPart === 'settings') {
        // At root, no segments
    }

    // Parse query params
    const params: Record<string, string> = {};
    if (queryPart) {
        const searchParams = new URLSearchParams(queryPart);
        searchParams.forEach((value, key) => {
            params[key] = value;
        });
    }

    return { segments, params };
}

/**
 * Build hash URL from path segments and optional params
 */
function buildHash(segments: string[], params?: Record<string, string>): string {
    let hash = '#settings';
    if (segments.length > 0) {
        hash += '/' + segments.join('/');
    }
    if (params && Object.keys(params).length > 0) {
        const searchParams = new URLSearchParams(params);
        hash += '?' + searchParams.toString();
    }
    return hash;
}

/**
 * Get segment labels from settings config (single source of truth).
 * Computed once on module load for performance.
 */
const SEGMENT_LABELS = getSegmentLabels();

interface SettingsNavProviderProps {
    children: ReactNode;
}

export function SettingsNavProvider({ children }: SettingsNavProviderProps): React.JSX.Element {
    const [path, setPath] = useState<SettingsNavPath>(() => parseHash(window.location.hash));
    const [animationDirection, setAnimationDirection] = useState<AnimationDirection>('none');

    // Track if navigation is programmatic (app-triggered) vs browser-triggered (swipe gestures)
    const isProgrammaticNavRef = useRef(false);

    // Listen for hash changes (browser back/forward, direct navigation)
    useEffect(() => {
        const handleHashChange = (): void => {
            const newPath = parseHash(window.location.hash);

            // If this is browser-triggered (swipe gesture, back/forward button), skip animation
            if (!isProgrammaticNavRef.current) {
                setAnimationDirection('none');
            }

            // Reset the flag for next navigation
            isProgrammaticNavRef.current = false;

            setPath(newPath);
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Navigate forward to a new path
    const navigate = useCallback((targetPath: string): void => {
        isProgrammaticNavRef.current = true;
        setAnimationDirection('forward');

        // If targetPath starts with /, treat as absolute from settings root
        // Otherwise, treat as relative to current path
        let newSegments: string[];
        let params: Record<string, string> = {};

        // Check for query params in target
        const [pathPart, queryPart] = targetPath.split('?');
        if (queryPart) {
            const searchParams = new URLSearchParams(queryPart);
            searchParams.forEach((value, key) => {
                params[key] = value;
            });
        }

        if (pathPart.startsWith('/')) {
            // Absolute path from settings root
            newSegments = pathPart.slice(1).split('/').filter(Boolean);
        } else {
            // Relative path - append to current
            newSegments = [...path.segments, ...pathPart.split('/').filter(Boolean)];
        }

        window.location.hash = buildHash(newSegments, params);
    }, [path.segments]);

    // Go back one level
    const goBack = useCallback((): void => {
        if (path.segments.length === 0) return;

        isProgrammaticNavRef.current = true;
        setAnimationDirection('backward');
        const newSegments = path.segments.slice(0, -1);
        window.location.hash = buildHash(newSegments);
    }, [path.segments]);

    // Go to settings root
    const goToRoot = useCallback((): void => {
        isProgrammaticNavRef.current = true;
        setAnimationDirection('backward');
        window.location.hash = '#settings';
    }, []);

    // Get breadcrumb labels
    const getBreadcrumbs = useCallback((): string[] => {
        return path.segments.map(segment => SEGMENT_LABELS[segment] || segment);
    }, [path.segments]);

    // Memoize context value to prevent unnecessary re-renders
    const value: SettingsNavContextValue = useMemo(() => ({
        path,
        animationDirection,
        navigate,
        goBack,
        goToRoot,
        canGoBack: path.segments.length > 0,
        depth: path.segments.length,
        getBreadcrumbs
    }), [path, animationDirection, navigate, goBack, goToRoot, getBreadcrumbs]);

    return (
        <SettingsNavContext.Provider value={value}>
            {children}
        </SettingsNavContext.Provider>
    );
}

export function useSettingsNav(): SettingsNavContextValue {
    const context = useContext(SettingsNavContext);
    if (context === undefined) {
        throw new Error('useSettingsNav must be used within SettingsNavProvider');
    }
    return context;
}

export default SettingsNavContext;

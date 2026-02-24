import { useState, useEffect, useRef, RefObject } from 'react';
import logger from '../../../utils/logger';
import type { Tab, TabsApiResponse } from '../types';

interface UseTabDataReturn {
    // Tab data
    tabs: Tab[];
    loadedTabs: Set<string>;
    activeSlug: string | null;

    // Loading state
    loading: boolean;
    error: string | null;

    // Iframe state per tab
    iframeLoadingStates: Record<string, boolean>;
    reloadKeys: Record<string, number>;

    // Refs
    containerRef: RefObject<HTMLDivElement | null>;

    // Actions
    reloadTab: (slug: string) => void;
    handleIframeLoad: (slug: string) => void;
    fetchTabs: () => Promise<void>;
}

/**
 * Hook for managing tab data, loading states, and navigation.
 * Handles fetching tabs from API, hash-based navigation, and iframe loading.
 * 
 * @param singleTabSlug - When provided, operates in single-tab mode for keep-alive architecture.
 *                        This tab will be automatically marked as loaded.
 */
export function useTabData(singleTabSlug?: string): UseTabDataReturn {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [loadedTabs, setLoadedTabs] = useState<Set<string>>(() =>
        singleTabSlug ? new Set([singleTabSlug]) : new Set()
    );
    const [activeSlug, setActiveSlug] = useState<string | null>(singleTabSlug || null);
    const [reloadKeys, setReloadKeys] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [iframeLoadingStates, setIframeLoadingStates] = useState<Record<string, boolean>>({});

    const containerRef = useRef<HTMLDivElement | null>(null);

    // Fetch all tabs on mount and listen for updates
    useEffect(() => {
        fetchTabs();

        const handleTabsUpdated = (): void => {
            fetchTabs();
        };

        window.addEventListener('tabsUpdated', handleTabsUpdated);
        return () => window.removeEventListener('tabsUpdated', handleTabsUpdated);
    }, []);

    // Prevent touch scrolling on the container (iOS scroll lock)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const preventTouchScroll = (e: TouchEvent): void => {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'IFRAME') {
                e.preventDefault();
            }
        };

        const preventWheelScroll = (e: WheelEvent): void => {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'IFRAME') {
                e.preventDefault();
            }
        };

        container.addEventListener('touchmove', preventTouchScroll, { passive: false });
        container.addEventListener('wheel', preventWheelScroll, { passive: false });

        return () => {
            container.removeEventListener('touchmove', preventTouchScroll);
            container.removeEventListener('wheel', preventWheelScroll);
        };
    }, []);

    // Handle hash changes for tab navigation (only in legacy multi-tab mode)
    useEffect(() => {
        // In single-tab mode, skip hash-based navigation
        if (singleTabSlug) {
            return;
        }

        const handleHashChange = (): void => {
            const hash = window.location.hash.slice(1);
            if (hash && hash !== 'dashboard' && hash !== 'settings') {
                logger.debug('Hash changed to:', { hash });
                setActiveSlug(hash);
                setLoadedTabs(prev => new Set([...prev, hash]));
            }
        };

        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [tabs, singleTabSlug]);

    const fetchTabs = async (): Promise<void> => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/tabs', {
                credentials: 'include'
            });

            if (!response.ok) {
                setError('Failed to load tabs');
                setLoading(false);
                return;
            }

            const data = await response.json() as TabsApiResponse;
            const fetchedTabs = (data.tabs || []).filter(t => t.enabled !== false);
            setTabs(fetchedTabs);
            setError(null);
        } catch (err) {
            logger.error('Error fetching tabs:', { error: err });
            setError('Failed to load tabs');
        } finally {
            setLoading(false);
        }
    };

    const handleIframeLoad = (slug: string): void => {
        logger.debug('Iframe loaded:', { slug });
        setIframeLoadingStates(prev => ({ ...prev, [slug]: false }));
    };

    const reloadTab = (slug: string): void => {
        logger.info('Reloading tab:', { slug });
        setIframeLoadingStates(prev => ({ ...prev, [slug]: true }));
        setReloadKeys(prev => ({ ...prev, [slug]: (prev[slug] || 0) + 1 }));
    };

    return {
        tabs,
        loadedTabs,
        activeSlug,
        loading,
        error,
        iframeLoadingStates,
        reloadKeys,
        containerRef,
        reloadTab,
        handleIframeLoad,
        fetchTabs,
    };
}

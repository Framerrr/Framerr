import { useEffect, useState, useRef } from 'react';
import { configApi } from '../api/endpoints';
import logger from '../utils/logger';

const FaviconInjector = (): null => {
    const [authorizedFavicon, setAuthorizedFavicon] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState<boolean>(false); // Track if we've loaded from API
    const observerRef = useRef<MutationObserver | null>(null);
    const isApplyingRef = useRef<boolean>(false); // Prevent infinite loops

    useEffect(() => {
        logger.debug('FaviconInjector mounted - loading favicon config');

        const loadFavicon = async (): Promise<void> => {
            try {
                const response = await configApi.getFavicon();

                const { htmlSnippet, enabled } = response;

                // Store the authorized favicon HTML (or null for default)
                if (htmlSnippet && htmlSnippet.trim() && enabled !== false) {
                    setAuthorizedFavicon(htmlSnippet);
                    logger.debug('Custom favicon authorized');
                } else {
                    setAuthorizedFavicon(null);
                    logger.debug('Using default Framerr favicon');
                }
                setIsLoaded(true); // Mark as loaded regardless of custom/default
            } catch (error) {
                logger.error('Failed to load favicon config:', { error });
                setAuthorizedFavicon(null);
                setIsLoaded(true); // Still mark as loaded, use default
            }
        };

        loadFavicon();

        // Listen for favicon update events from settings
        const handleFaviconUpdate = (): void => {
            logger.debug('Favicon updated, reloading...');
            // Immediately clear existing favicons for faster visual feedback
            const allFaviconLinks = document.querySelectorAll('link[rel*="icon"]');
            allFaviconLinks.forEach(link => link.remove());
            setIsLoaded(false); // Reset to trigger reload
            loadFavicon();
        };
        window.addEventListener('faviconUpdated', handleFaviconUpdate);

        return () => {
            window.removeEventListener('faviconUpdated', handleFaviconUpdate);
        };
    }, []);

    useEffect(() => {
        if (!isLoaded) {
            // Still loading from API, don't apply anything yet
            return;
        }

        const applyAuthorizedFavicon = (): void => {
            if (isApplyingRef.current) return; // Prevent recursion
            isApplyingRef.current = true;

            try {
                // Remove ALL existing favicon elements
                const allFaviconLinks = document.querySelectorAll('link[rel*="icon"]');
                allFaviconLinks.forEach(link => link.remove());

                const cacheBuster = `?v=${Date.now()}`;

                if (authorizedFavicon) {
                    // Apply custom favicon
                    const temp = document.createElement('div');
                    const htmlWithCacheBust = authorizedFavicon.replace(/href="([^"]+)"/g, (match, url) => {
                        return `href="${url}${cacheBuster}"`;
                    });
                    temp.innerHTML = htmlWithCacheBust;

                    Array.from(temp.children).forEach(child => {
                        (child as Element).setAttribute('data-favicon-authorized', 'true');
                        document.head.appendChild(child);
                    });
                    logger.debug('Applied custom favicon');
                } else {
                    // Apply default Framerr favicon - full set for all browsers
                    const defaultLinks = [
                        { rel: 'icon', type: 'image/x-icon', href: '/favicon/favicon.ico' },
                        { rel: 'icon', type: 'image/svg+xml', href: '/favicon/favicon.svg' },
                        { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/favicon/favicon-96x96.png' },
                        { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon/apple-touch-icon.png' },
                    ];

                    defaultLinks.forEach(({ rel, type, sizes, href }) => {
                        const link = document.createElement('link');
                        link.rel = rel;
                        if (type) link.type = type;
                        if (sizes) link.sizes.add(sizes);
                        link.href = `${href}${cacheBuster}`;
                        link.setAttribute('data-favicon-authorized', 'true');
                        document.head.appendChild(link);
                    });
                    logger.debug('Applied default favicon set');
                }

                // Mark that favicon has been applied
                document.documentElement.setAttribute('data-favicon-loaded', 'true');
            } finally {
                isApplyingRef.current = false;
            }
        };

        // Apply favicon immediately when loaded
        applyAuthorizedFavicon();

        // Set up MutationObserver to enforce favicon authority
        const observer = new MutationObserver((mutations) => {
            let needsReapply = false;

            for (const mutation of mutations) {
                // Check if any favicon-related nodes were added or removed
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if ((node as Element).tagName === 'LINK' &&
                            (node as Element).getAttribute('rel')?.includes('icon') &&
                            !(node as Element).hasAttribute('data-favicon-authorized')) {
                            // Unauthorized favicon added!
                            logger.warn('Unauthorized favicon detected, blocking');
                            needsReapply = true;
                        }
                    });

                    mutation.removedNodes.forEach(node => {
                        if ((node as Element).tagName === 'LINK' &&
                            (node as Element).getAttribute('rel')?.includes('icon') &&
                            (node as Element).hasAttribute('data-favicon-authorized')) {
                            // Our authorized favicon was removed!
                            logger.warn('Authorized favicon was removed, reapplying');
                            needsReapply = true;
                        }
                    });
                }

                // Check if any authorized favicon had its attributes modified
                if (mutation.type === 'attributes' &&
                    (mutation.target as Element).tagName === 'LINK' &&
                    (mutation.target as Element).hasAttribute('data-favicon-authorized')) {
                    logger.warn('Authorized favicon modified, reapplying');
                    needsReapply = true;
                }
            }

            if (needsReapply) {
                applyAuthorizedFavicon();
            }
        });

        // Observe the <head> element for any changes
        observer.observe(document.head, {
            childList: true,
            attributes: true,
            subtree: false,
            attributeFilter: ['href', 'rel', 'type']
        });

        observerRef.current = observer;

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [authorizedFavicon, isLoaded]);

    // This component doesn't render anything
    return null;
};

export default FaviconInjector;

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useTabData } from './hooks/useTabData';
import { useTabAuth } from './hooks/useTabAuth';
import { TabToolbar } from './components/TabToolbar';
import { AuthOverlay } from './components/AuthOverlay';

/**
 * TabContainer Props
 * 
 * When used with keep-alive architecture:
 * - singleTabSlug: Only render the specified tab
 * - onCloseTab: Callback when user clicks close button
 */
interface TabContainerProps {
    /** When specified, only render this single tab */
    singleTabSlug?: string;
    /** Callback to close/unmount this tab */
    onCloseTab?: () => void;
}

/**
 * TabContainer - Thin orchestrator for embedded iframe tabs.
 * 
 * Manages lazy-loaded iframes for external services with:
 * - Hash-based navigation between tabs (legacy mode)
 * - Single tab mode for keep-alive architecture
 * - Automatic and manual OAuth authentication flow
 * - Per-tab reload functionality
 * - iOS scroll lock prevention
 */
const TabContainer = ({
    singleTabSlug,
    onCloseTab,
}: TabContainerProps): React.JSX.Element | null => {
    // Data and navigation
    const {
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
    } = useTabData(singleTabSlug);

    // Authentication
    const {
        needsAuth,
        isReloading,
        iframeAuthEnabled,
        iframeRefs,
        handleOpenAuth,
        handleManualAuth,
        handleDismissOverlay,
    } = useTabAuth({ tabs, loadedTabs, reloadTab });

    // Loading state - splash screen covers everything
    if (loading) {
        return null;
    }

    // Error state
    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center text-slate-400">
                    <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
                    <h2 className="text-xl font-bold text-white mb-2">Error</h2>
                    <p>{error}</p>
                    <button
                        onClick={() => window.location.hash = 'dashboard'}
                        className="mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Empty state
    if (tabs.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center text-slate-400">
                    <AlertCircle size={48} className="mx-auto mb-4 text-yellow-400" />
                    <h2 className="text-xl font-bold text-white mb-2">No Tabs Found</h2>
                    <p>You don't have any tabs configured yet.</p>
                    <button
                        onClick={() => window.location.hash = 'settings'}
                        className="mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                    >
                        Go to Settings
                    </button>
                </div>
            </div>
        );
    }

    // In single tab mode, only render that specific tab
    const tabsToRender = singleTabSlug
        ? [singleTabSlug].filter(slug => loadedTabs.has(slug))
        : Array.from(loadedTabs);

    return (
        <div
            ref={containerRef}
            className="w-full h-full flex flex-col"
            style={{ overscrollBehavior: 'none' }}
        >
            {/* Render iframes for tabs */}
            {tabsToRender.map(slug => {
                const tab = tabs.find(t => t.slug === slug);
                if (!tab) return null;

                // In single tab mode, always show. Otherwise use activeSlug.
                const isActive = singleTabSlug ? true : slug === activeSlug;
                const isLoading = iframeLoadingStates[slug] !== false;
                const showAuthOverlay = needsAuth[slug] || isReloading[slug];

                return (
                    <div
                        key={slug}
                        style={{ display: isActive ? 'flex' : 'none', maxHeight: '100%' }}
                        className="w-full h-full flex flex-col min-h-0"
                    >
                        <TabToolbar
                            tab={tab}
                            iframeAuthEnabled={iframeAuthEnabled}
                            onReload={() => reloadTab(slug)}
                            onManualAuth={() => handleManualAuth(slug)}
                            onClose={onCloseTab}
                        />

                        {/* Iframe Container */}
                        <div className="flex-1 relative bg-white min-h-0 overflow-hidden">
                            {/* Loading overlay */}
                            {isLoading && (
                                <div className="absolute inset-0 bg-theme-primary flex items-center justify-center z-10">
                                    <div className="text-center text-theme-secondary">
                                        <div className="w-8 h-8 border-2 border-theme border-t-accent rounded-full animate-spin mx-auto mb-3" />
                                        <p className="text-sm">Loading {tab.name}...</p>
                                    </div>
                                </div>
                            )}

                            <iframe
                                ref={el => { iframeRefs.current[slug] = el; }}
                                key={reloadKeys[slug] || 0}
                                src={tab.url}
                                title={tab.name}
                                className="w-full h-full border-none"
                                onLoad={() => handleIframeLoad(slug)}
                                allow="clipboard-read; clipboard-write; fullscreen"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
                            />

                            {/* Auth Required Overlay */}
                            {showAuthOverlay && (
                                <AuthOverlay
                                    isReloading={isReloading[slug] || false}
                                    onOpenAuth={() => handleOpenAuth(slug, iframeRefs.current[slug]?.src || tab.url)}
                                    onReload={() => reloadTab(slug)}
                                    onDismiss={() => handleDismissOverlay(slug)}
                                />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default TabContainer;

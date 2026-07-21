import React from 'react';
import { RefreshCw, ExternalLink, Lock, X } from 'lucide-react';
import type { Tab } from '../types';

interface TabToolbarProps {
    tab: Tab;
    iframeAuthEnabled: boolean;
    onReload: () => void;
    onManualAuth: () => void;
    /** Optional: Close button callback - closes tab and returns to dashboard */
    onClose?: () => void;
}

/**
 * Toolbar for a tab with title, reload, auth, external link, and close buttons.
 */
export const TabToolbar: React.FC<TabToolbarProps> = ({
    tab,
    iframeAuthEnabled,
    onReload,
    onManualAuth,
    onClose,
}) => {
    return (
        <div className="h-12 bg-theme-primary border-b border-theme flex items-center justify-between px-4 flex-shrink-0">
            <div className="flex items-center gap-2">
                <h3 className="font-semibold text-theme-primary">{tab.name}</h3>
            </div>

            <div className="flex items-center gap-3">
                {iframeAuthEnabled && (
                    <button
                        onClick={onManualAuth}
                        className="text-theme-tertiary hover:text-theme-primary transition-colors"
                        title="Re-authenticate"
                    >
                        <Lock size={18} />
                    </button>
                )}
                <button
                    onClick={onReload}
                    className="text-theme-tertiary hover:text-theme-primary transition-colors"
                    title="Reload"
                >
                    <RefreshCw size={18} />
                </button>
                <a
                    href={tab.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-theme-tertiary hover:text-theme-primary transition-colors"
                    title="Open in new tab"
                >
                    <ExternalLink size={18} />
                </a>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-theme-tertiary hover:text-error transition-colors ml-1"
                        title="Close tab"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

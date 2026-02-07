import React from 'react';
import { Lock, ExternalLink, X } from 'lucide-react';

interface AuthOverlayProps {
    isReloading: boolean;
    onOpenAuth: () => void;
    onReload: () => void;
    onDismiss: () => void;
}

/**
 * Overlay shown when iframe authentication is required.
 * Shows either a loading spinner (during reload) or login buttons.
 */
export const AuthOverlay: React.FC<AuthOverlayProps> = ({
    isReloading,
    onOpenAuth,
    onReload,
    onDismiss,
}) => {
    return (
        <div
            className="absolute inset-0 flex items-center justify-center z-20 bg-black/60 backdrop-blur-sm"
            onClick={() => !isReloading && onDismiss()}
        >
            <div
                className="glass-card max-w-md w-full mx-4 p-8 text-center border border-theme rounded-xl shadow-heavy"
                onClick={(e) => e.stopPropagation()}
            >
                {isReloading ? (
                    <>
                        <div
                            className="w-16 h-16 border-4 mx-auto mb-6 rounded-full animate-spin"
                            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
                        />
                        <h3 className="text-xl font-semibold mb-2 text-theme-primary">
                            Verifying Authentication...
                        </h3>
                        <p className="text-theme-secondary text-sm">
                            Please wait while we reload the page
                        </p>
                    </>
                ) : (
                    <>
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                            style={{ backgroundColor: 'var(--accent-transparent)' }}
                        >
                            <Lock size={32} style={{ color: 'var(--accent)' }} />
                        </div>
                        <h3 className="text-xl font-semibold mb-4 text-theme-primary">
                            Open Login in New Tab
                        </h3>
                        <p className="text-theme-secondary mb-6 text-sm">
                            You will be redirected back after successful authentication.
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={onOpenAuth}
                                className="w-full px-4 py-3 rounded-lg font-medium text-white transition-all"
                                style={{ backgroundColor: 'var(--accent)' }}
                            >
                                <ExternalLink className="inline mr-2" size={18} />
                                Open Login
                            </button>
                            <button
                                onClick={() => { onDismiss(); onReload(); }}
                                className="w-full px-4 py-3 border rounded-lg font-medium transition-all text-theme-secondary border-theme hover:border-theme-light"
                            >
                                Reload Page
                            </button>
                        </div>
                        <button
                            onClick={onDismiss}
                            className="absolute top-4 right-4 transition-all text-theme-tertiary hover:text-theme-primary"
                            title="Dismiss"
                        >
                            <X size={20} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

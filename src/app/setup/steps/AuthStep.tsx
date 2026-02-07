import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Shield, Loader, CheckCircle, ExternalLink } from 'lucide-react';
import { plexApi } from '../../../api/endpoints';
import { Switch } from '@/shared/ui';
import type { WizardData } from '../SetupWizard';

interface AuthStepProps {
    data: WizardData;
    updateData: (updates: Partial<WizardData>) => void;
    goNext: () => void;
    goBack: () => void;
    skip: () => void;
    loading: boolean;
    error: string | null;
    saveAuthSettings: () => Promise<boolean>;
}

// Plex brand colors
const PLEX_BG = '#e5a00d';
const PLEX_TEXT = '#000000';

const AuthStep: React.FC<AuthStepProps> = ({
    data,
    updateData,
    goNext,
    goBack,
    skip,
    loading,
    saveAuthSettings
}) => {
    const [plexConnecting, setPlexConnecting] = useState(false);
    const [plexConnected, setPlexConnected] = useState(false);
    const [plexError, setPlexError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    const connectPlex = async () => {
        setPlexConnecting(true);
        setPlexError(null);

        try {
            // Get PIN from Plex (no forwardUrl - popup will close itself after auth)
            const pinResponse = await plexApi.createPin('');

            const { pinId, authUrl } = pinResponse;

            // Open Plex auth in new window
            const authWindow = window.open(authUrl, 'PlexAuth', 'width=600,height=700');

            // Poll for token
            pollIntervalRef.current = setInterval(async () => {
                try {
                    const tokenResponse = await plexApi.getToken(pinId);

                    if (tokenResponse.authToken) {
                        // Token received!
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                        }

                        // Save SSO config with the token
                        await plexApi.saveSSOConfig({
                            enabled: true,
                            adminToken: tokenResponse.authToken,
                            adminEmail: tokenResponse.user?.email,
                            adminPlexId: tokenResponse.user?.id?.toString(),
                            autoCreateUsers: data.autoCreateUsers
                        });

                        setPlexConnected(true);
                        setPlexConnecting(false);
                        updateData({ plexSSOEnabled: true });

                        // Close auth window if still open
                        if (authWindow && !authWindow.closed) {
                            authWindow.close();
                        }
                    }
                } catch (err) {
                    // Keep polling unless it's an error
                    const error = err as { response?: { status?: number } };
                    if (error.response?.status === 404) {
                        // PIN expired
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                        }
                        setPlexError('Authentication timed out. Please try again.');
                        setPlexConnecting(false);
                    }
                }
            }, 2000);

            // Timeout after 5 minutes
            setTimeout(() => {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                }
                if (plexConnecting) {
                    setPlexError('Authentication timed out. Please try again.');
                    setPlexConnecting(false);
                }
            }, 300000);

        } catch (err) {
            setPlexError('Failed to start Plex authentication');
            setPlexConnecting(false);
        }
    };

    const handleNext = async () => {
        setSaving(true);
        const success = await saveAuthSettings();
        setSaving(false);
        if (success) {
            goNext();
        }
    };

    const isLoading = loading || saving || plexConnecting;

    return (
        <div className="glass-subtle p-8 rounded-2xl border border-theme">
            {/* Header */}
            <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4 shadow-lg"
                    style={{ boxShadow: '0 0 20px var(--accent-glow)' }}
                >
                    <Shield size={24} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-theme-primary mb-2">
                    Authentication Options
                </h2>
                <p className="text-theme-secondary">
                    Enable single sign-on with Plex
                </p>
            </motion.div>

            {/* Plex SSO Section */}
            <motion.div
                className="mb-6 p-5 rounded-xl border border-theme bg-theme-secondary/30"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill={PLEX_BG}>
                            <path d="M12 2L2 12l10 10 10-10L12 2zm0 3.5L18.5 12 12 18.5 5.5 12 12 5.5z" />
                        </svg>
                        <div>
                            <span className="font-medium text-theme-primary block">
                                Plex SSO
                            </span>
                            <span className="text-xs text-theme-tertiary">
                                Let users log in with their Plex account
                            </span>
                        </div>
                    </div>

                    {plexConnected && (
                        <div className="flex items-center gap-2 text-success">
                            <CheckCircle size={18} />
                            <span className="text-sm">Connected</span>
                        </div>
                    )}
                </div>

                {plexError && (
                    <div className="mb-4 p-2 rounded-lg text-sm"
                        style={{
                            backgroundColor: 'var(--error-bg, rgba(239, 68, 68, 0.1))',
                            color: 'var(--error)'
                        }}
                    >
                        {plexError}
                    </div>
                )}

                {!plexConnected ? (
                    <motion.button
                        onClick={connectPlex}
                        disabled={plexConnecting}
                        className="w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
                        style={{
                            backgroundColor: PLEX_BG,
                            color: PLEX_TEXT,
                            opacity: plexConnecting ? 0.7 : 1
                        }}
                        whileHover={!plexConnecting ? { scale: 1.02 } : {}}
                        whileTap={!plexConnecting ? { scale: 0.98 } : {}}
                    >
                        {plexConnecting ? (
                            <>
                                <Loader size={18} className="animate-spin" />
                                Waiting for Plex...
                            </>
                        ) : (
                            <>
                                Connect Plex Account
                                <ExternalLink size={16} />
                            </>
                        )}
                    </motion.button>
                ) : (
                    <div className="space-y-3">
                        {/* Auto-create users toggle */}
                        <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg bg-theme-tertiary/30">
                            <div>
                                <span className="text-sm font-medium text-theme-primary block">
                                    Auto-create users
                                </span>
                                <span className="text-xs text-theme-tertiary">
                                    Automatically create accounts for Plex users
                                </span>
                            </div>
                            <Switch
                                checked={data.autoCreateUsers}
                                onCheckedChange={(checked: boolean) => updateData({ autoCreateUsers: checked })}
                            />
                        </label>
                    </div>
                )}
            </motion.div>

            {/* Info */}
            <motion.p
                className="text-xs text-theme-tertiary text-center mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                You can configure additional authentication options in Settings later
            </motion.p>

            {/* Navigation */}
            <div className="flex justify-between">
                <motion.button
                    type="button"
                    onClick={goBack}
                    className="px-4 py-2 text-theme-secondary hover:text-theme-primary flex items-center gap-2 transition-colors"
                    whileHover={{ x: -4 }}
                    disabled={isLoading}
                >
                    <ArrowLeft size={18} />
                    Back
                </motion.button>

                <div className="flex gap-3">
                    <motion.button
                        type="button"
                        onClick={skip}
                        className="px-4 py-2 text-theme-tertiary hover:text-theme-secondary transition-colors"
                        disabled={isLoading}
                    >
                        Skip
                    </motion.button>

                    <motion.button
                        type="button"
                        onClick={handleNext}
                        disabled={isLoading}
                        className={`px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium flex items-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        whileHover={!isLoading ? { scale: 1.02 } : {}}
                        whileTap={!isLoading ? { scale: 0.98 } : {}}
                    >
                        {saving ? (
                            <>
                                <Loader size={18} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                Next
                                <ArrowRight size={18} />
                            </>
                        )}
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

export default AuthStep;

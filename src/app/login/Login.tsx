import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { plexApi, themeApi, authApi } from '../../api/endpoints';
import { resetSessionExpiredFlag } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Lock, User, AlertCircle, Loader, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '../../shared/ui';
import { getIconComponent } from '../../utils/iconUtils';

// Types are now imported from API layer

interface LocationState {
    from?: { pathname: string };
    loggedOut?: boolean;
}

const Login = (): React.JSX.Element => {
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [plexSSOEnabled, setPlexSSOEnabled] = useState<boolean>(false);
    const [oidcEnabled, setOidcEnabled] = useState<boolean>(false);
    const [oidcDisplayName, setOidcDisplayName] = useState<string>('SSO');
    const [oidcButtonIcon, setOidcButtonIcon] = useState<string>('KeyRound');
    const [oidcLoading, setOidcLoading] = useState<boolean>(false);
    // Initialize to true if returning from Plex OAuth to prevent form flash
    const [plexLoading, setPlexLoading] = useState<boolean>(() =>
        !!localStorage.getItem('plexPendingPinId')
    );
    const { login, loginWithPlex, isAuthenticated, loading: authLoading } = useAuth();
    const { success: showSuccess, info: showInfo, error: showError } = useNotifications();
    const navigate = useNavigate();
    const location = useLocation();

    const locationState = location.state as LocationState | null;
    const from = locationState?.from?.pathname || '/';
    const loggedOut = locationState?.loggedOut;

    // Reset session expired toast flag on mount (prevents duplicate toasts)
    useEffect(() => {
        resetSessionExpiredFlag();
    }, []);

    // Check for post-restore success message (admin only)
    useEffect(() => {
        const restoredFromBackup = localStorage.getItem('restoredFromBackup');
        if (restoredFromBackup) {
            localStorage.removeItem('restoredFromBackup');
            showSuccess('Backup Restored', 'System restored successfully');
        }
    }, [showSuccess]);

    // Fetch admin's theme for login page (public endpoint, no auth required)
    useEffect(() => {
        const fetchDefaultTheme = async (): Promise<void> => {
            try {
                const response = await themeApi.getDefaultTheme();
                if (response.theme) {
                    document.documentElement.setAttribute('data-theme', response.theme);
                }
            } catch {
                // Silently fail - keep whatever theme is currently applied
            }
        };
        fetchDefaultTheme();
    }, []);

    // Fetch SSO configuration (which SSO methods are available)
    useEffect(() => {
        const timer = setTimeout(async () => {
            try {
                const response = await authApi.getSSOConfig();
                setPlexSSOEnabled(response.plex.enabled);
                setOidcEnabled(response.oidc.enabled);
                if (response.oidc.displayName) {
                    setOidcDisplayName(response.oidc.displayName);
                }
                if (response.oidc.buttonIcon) {
                    setOidcButtonIcon(response.oidc.buttonIcon);
                }
            } catch {
                // SSO not available - that's fine, just hide SSO buttons
            }
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Handle OIDC callback errors (server redirects back with ?error= param)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const oidcError = params.get('error');
        if (oidcError) {
            const errorMessages: Record<string, string> = {
                'no_account': 'No account found. Contact your administrator.',
                'auth_expired': 'Authentication expired. Please try again.',
                'state_expired': 'Authentication session expired. Please try again.',
                'state_invalid': 'Invalid authentication session. Please try again.',
                'discovery_failed': 'Could not reach the identity provider. It may be down — try again later.',
                'not_configured': 'SSO is not properly configured. Contact your administrator.',
                'missing_claims': 'Identity provider did not return required information. Contact your administrator.',
                'oidc_failed': 'SSO authentication failed. Please try again.',
                'missing_state': 'Invalid authentication response. Please try again.',
                'rate_limited': 'Too many attempts. Please wait and try again.',
            };
            setError(errorMessages[oidcError] || decodeURIComponent(oidcError));
            // Clean up URL params
            window.history.replaceState({}, '', '/login');
        }
    }, []);

    // Show logout message if coming from logout
    useEffect(() => {
        if (loggedOut) {
            showInfo('Goodbye!', 'You have been logged out');
            navigate('/login', { replace: true, state: {} });
        }
    }, [loggedOut, showInfo, navigate]);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, navigate, from]);

    // Track if Plex auth completion has started (prevents duplicate in Strict Mode)
    const plexAuthAttempted = useRef(false);

    // Check for pending Plex auth on page load (redirect flow)
    useEffect(() => {
        const completePlexAuth = async (): Promise<void> => {
            const pendingPinId = localStorage.getItem('plexPendingPinId');
            if (!pendingPinId || plexAuthAttempted.current) return;

            plexAuthAttempted.current = true;
            setPlexLoading(true);

            try {
                // Check if the PIN has been claimed
                const tokenResponse = await plexApi.getToken(pendingPinId);

                if (tokenResponse.authToken && tokenResponse.user) {
                    const { authToken, user } = tokenResponse;
                    const result = await loginWithPlex(authToken, user.id);

                    localStorage.removeItem('plexPendingPinId');

                    if (result.needsAccountSetup && result.setupToken) {
                        // New Plex user - redirect to account setup page
                        navigate(`/sso-setup?token=${result.setupToken}`, { replace: true });
                    } else if (result.success) {
                        showSuccess('Welcome!', `Signed in as ${user.username}`);
                        navigate(from, { replace: true });
                    } else {
                        setError(result.error || 'Plex login failed');
                    }
                } else {
                    // Token not ready yet - this shouldn't happen with the redirect flow
                    localStorage.removeItem('plexPendingPinId');
                    setError('Plex authentication incomplete. Please try again.');
                }
            } catch (err) {
                const apiError = err as { status?: number; message?: string };
                localStorage.removeItem('plexPendingPinId');
                if (apiError.status === 404) {
                    setError('Plex authentication expired. Please try again.');
                } else {
                    setError(apiError.message || 'Failed to complete Plex login');
                }
            } finally {
                setPlexLoading(false);
            }
        };

        completePlexAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(username, password, rememberMe);
            if (result.success) {
                if (result.requirePasswordChange) {
                    // User must change password before accessing dashboard
                    navigate('/change-password', { replace: true });
                } else {
                    showSuccess('Welcome!', 'You have successfully logged in');
                    navigate(from, { replace: true });
                }
            } else {
                setError(result.error || 'Login failed');
            }
        } catch (err) {
            const error = err as Error;
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handlePlexLogin = async (): Promise<void> => {
        setPlexLoading(true);
        setError('');

        try {
            const pinResponse = await plexApi.createPin(`${window.location.origin}/login`);

            const { pinId, authUrl } = pinResponse;

            // Store PIN ID for when we return from Plex
            localStorage.setItem('plexPendingPinId', pinId.toString());

            // Redirect to Plex (no popup, full page redirect)
            window.location.href = authUrl;

        } catch (err) {
            const apiError = err as { message?: string };
            setError(apiError.message || 'Failed to connect to Plex');
            setPlexLoading(false);
        }
    };

    const handleOidcLogin = async (): Promise<void> => {
        setOidcLoading(true);
        setError('');

        try {
            const response = await authApi.oidcLogin();
            // Full page redirect to IdP (same pattern as Plex)
            window.location.href = response.redirectUrl;
        } catch (err) {
            const apiError = err as { message?: string };
            setError(apiError.message || 'Failed to initiate SSO login');
            setOidcLoading(false);
        }
    };

    // Splash screen covers everything during auth check AND Plex OAuth completion
    // Don't show any UI until auth is determined (prevents login form flash)
    if (authLoading || (plexLoading && localStorage.getItem('plexPendingPinId'))) {
        return <></>;
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-theme-primary p-4">
            <motion.div
                className="w-full max-w-md mx-auto glass-subtle p-10 rounded-2xl shadow-xl border border-theme"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 30 }}
            >
                <div className="text-center mb-10">
                    <motion.div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-accent shadow-lg"
                        style={{ boxShadow: '0 0 30px var(--accent-glow)' }}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 30 }}
                    >
                        <Lock size={28} className="text-white" />
                    </motion.div>
                    <motion.h2
                        className="text-3xl font-bold mb-2 text-theme-primary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        Welcome Back
                    </motion.h2>
                    <motion.p
                        className="text-theme-secondary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        Sign in to access your dashboard
                    </motion.p>
                </div>

                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            className="p-4 rounded-lg mb-6 flex items-center gap-3 text-sm border"
                            style={{
                                backgroundColor: 'var(--error-bg, rgba(239, 68, 68, 0.1))',
                                borderColor: 'var(--error-border, rgba(239, 68, 68, 0.2))',
                                color: 'var(--error)'
                            }}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                x: [0, -5, 5, -5, 5, 0]
                            }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{
                                opacity: { duration: 0.2 },
                                y: { type: "spring", stiffness: 220, damping: 30 },
                                x: { duration: 0.4 }
                            }}
                        >
                            <AlertCircle size={18} />
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit}>
                    <div className="mb-5">
                        <label className="block mb-2 text-sm font-medium text-theme-primary">Username</label>
                        <div className="relative">
                            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary transition-colors peer-focus:text-accent" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="peer w-full py-3.5 px-4 pl-12 bg-theme-primary border-2 border-theme rounded-xl text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-all"
                                style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)' }}
                                placeholder="Enter your username"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block mb-2 text-sm font-medium text-theme-primary">Password</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary transition-colors peer-focus:text-accent" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="peer w-full py-3.5 px-4 pl-12 pr-12 bg-theme-primary border-2 border-theme rounded-xl text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-all"
                                style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)' }}
                                placeholder="Enter your password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(prev => !prev)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-secondary opacity-50 hover:opacity-100 transition-all"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center mb-8">
                        <Checkbox
                            id="remember"
                            checked={rememberMe}
                            onCheckedChange={(checked) => setRememberMe(checked === true)}
                        />
                        <label htmlFor="remember" className="ml-3 text-sm text-theme-secondary cursor-pointer select-none hover:text-theme-primary transition-colors">Remember me</label>
                    </div>

                    <motion.button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 px-4 bg-accent text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        style={{ boxShadow: loading ? 'none' : '0 4px 14px var(--accent-glow)' }}
                        whileHover={!loading ? { scale: 1.02, boxShadow: '0 6px 20px var(--accent-glow)' } : {}}
                        whileTap={!loading ? { scale: 0.98 } : {}}
                        transition={{ type: "spring", stiffness: 220, damping: 30 }}
                    >
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-2"
                                >
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    >
                                        <Loader size={20} />
                                    </motion.div>
                                    Signing in...
                                </motion.div>
                            ) : (
                                <motion.span
                                    key="signin"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    Sign In
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </form>

                {/* SSO Buttons */}
                {(plexSSOEnabled || oidcEnabled) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-theme"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="px-2 bg-theme-secondary text-theme-tertiary rounded">or</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {plexSSOEnabled && (
                                <motion.button
                                    type="button"
                                    onClick={handlePlexLogin}
                                    disabled={plexLoading}
                                    className="w-full py-4 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                                    style={{
                                        backgroundColor: '#e5a00d',
                                        color: '#000',
                                        boxShadow: '0 4px 14px rgba(229, 160, 13, 0.3)'
                                    }}
                                    whileHover={!plexLoading ? { scale: 1.02 } : {}}
                                    whileTap={!plexLoading ? { scale: 0.98 } : {}}
                                >
                                    {plexLoading ? (
                                        <>
                                            <Loader className="animate-spin" size={20} />
                                            Connecting to Plex...
                                        </>
                                    ) : (
                                        <>
                                            {(() => {
                                                const PlexIcon = getIconComponent('system:plex');
                                                return <PlexIcon size={20} />;
                                            })()}
                                            Continue with Plex
                                        </>
                                    )}
                                </motion.button>
                            )}

                            {oidcEnabled && (
                                <motion.button
                                    type="button"
                                    onClick={handleOidcLogin}
                                    disabled={oidcLoading}
                                    className="w-full py-4 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 bg-theme-secondary text-theme-primary border-2 border-theme transition-all"
                                    whileHover={!oidcLoading ? { scale: 1.02 } : {}}
                                    whileTap={!oidcLoading ? { scale: 0.98 } : {}}
                                >
                                    {oidcLoading ? (
                                        <>
                                            <Loader className="animate-spin" size={20} />
                                            Redirecting...
                                        </>
                                    ) : (
                                        <>
                                            {(() => {
                                                const OidcIcon = getIconComponent(oidcButtonIcon);
                                                return <OidcIcon size={20} />;
                                            })()}
                                            {oidcDisplayName}
                                        </>
                                    )}
                                </motion.button>
                            )}
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

export default Login;

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Lock, User, Link, UserPlus, Loader, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logger from '../../utils/logger';

interface PlexUser {
    username: string;
    email?: string;
    thumb?: string;
}

interface ValidateResponse {
    valid: boolean;
    plexUser: PlexUser;
}

interface SetupResponse {
    success: boolean;
    user: {
        id: string;
        username: string;
        displayName: string;
        group: string;
    };
}

type SetupMode = 'choose' | 'link-existing' | 'create-new';

/**
 * PlexSetup - Account setup page for new Plex SSO users
 * Shows after Plex auth when no linked Framerr account exists
 */
const PlexSetup: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { checkAuth } = useAuth();
    const { success: showSuccess, error: showError } = useNotifications();

    // Token and Plex user state
    const [setupToken, setSetupToken] = useState<string | null>(null);
    const [plexUser, setPlexUser] = useState<PlexUser | null>(null);
    const [validating, setValidating] = useState(true);
    const [tokenError, setTokenError] = useState<string | null>(null);

    // Form state
    const [mode, setMode] = useState<SetupMode>('choose');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Validate token on mount
    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) {
            setTokenError('No setup token provided. Please try signing in with Plex again.');
            setValidating(false);
            return;
        }

        const validateToken = async () => {
            try {
                const response = await axios.post<ValidateResponse>('/api/auth/plex-setup/validate', { token });
                setSetupToken(token);
                setPlexUser(response.data.plexUser);
                // Pre-fill username from Plex
                setUsername(response.data.plexUser.username);
            } catch (err) {
                const axiosError = err as AxiosError<{ error?: string }>;
                logger.error('[PlexSetup] Token validation failed', { error: axiosError.message });
                setTokenError(axiosError.response?.data?.error || 'Invalid or expired setup link. Please try again.');
            } finally {
                setValidating(false);
            }
        };

        validateToken();
    }, [searchParams]);

    // Handle linking to existing account
    const handleLinkExisting = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post<SetupResponse>('/api/auth/plex-setup/link-existing', {
                setupToken,
                username,
                password
            });

            showSuccess('Account Linked!', `Welcome back, ${response.data.user.username}`);
            await checkAuth(); // Refresh auth state
            navigate('/', { replace: true });
        } catch (err) {
            const axiosError = err as AxiosError<{ error?: string }>;
            setError(axiosError.response?.data?.error || 'Failed to link account');
        } finally {
            setLoading(false);
        }
    };

    // Handle creating new account
    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post<SetupResponse>('/api/auth/plex-setup/create-account', {
                setupToken,
                username,
                password,
                confirmPassword
            });

            showSuccess('Account Created!', `Welcome, ${response.data.user.username}`);
            await checkAuth(); // Refresh auth state
            navigate('/', { replace: true });
        } catch (err) {
            const axiosError = err as AxiosError<{ error?: string }>;
            setError(axiosError.response?.data?.error || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    // Loading state while validating token
    if (validating) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-theme-primary p-4">
                <motion.div
                    className="flex flex-col items-center gap-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <Loader className="animate-spin text-accent" size={40} />
                    <p className="text-theme-secondary">Validating setup link...</p>
                </motion.div>
            </div>
        );
    }

    // Error state for invalid token
    if (tokenError) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-theme-primary p-4">
                <motion.div
                    className="w-full max-w-md mx-auto glass-subtle p-10 rounded-2xl shadow-xl border border-theme text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-error/20">
                        <AlertCircle className="text-error" size={28} />
                    </div>
                    <h2 className="text-xl font-bold text-theme-primary mb-2">Setup Link Expired</h2>
                    <p className="text-theme-secondary mb-6">{tokenError}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-3 bg-accent text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
                    >
                        Back to Login
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-theme-primary p-4">
            <motion.div
                className="w-full max-w-md mx-auto glass-subtle p-10 rounded-2xl shadow-xl border border-theme"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 30 }}
            >
                {/* Header with Plex user info */}
                <div className="text-center mb-8">
                    {plexUser?.thumb && (
                        <img
                            src={plexUser.thumb}
                            alt={plexUser.username}
                            className="w-16 h-16 rounded-full mx-auto mb-4 border-2 border-accent"
                        />
                    )}
                    <h2 className="text-2xl font-bold text-theme-primary mb-1">
                        {mode === 'choose' ? 'Set Up Your Account' :
                            mode === 'link-existing' ? 'Link Existing Account' : 'Create New Account'}
                    </h2>
                    <p className="text-theme-secondary text-sm">
                        Signed in to Plex as <span className="font-semibold text-accent">{plexUser?.username}</span>
                    </p>
                </div>

                {/* Error display */}
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
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <AlertCircle size={18} />
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mode selection */}
                {mode === 'choose' && (
                    <div className="space-y-4">
                        <p className="text-theme-secondary text-center mb-6">
                            This Plex account isn&apos;t linked to a Framerr account yet.
                        </p>

                        <motion.button
                            onClick={() => setMode('link-existing')}
                            className="w-full p-4 rounded-xl border-2 border-theme bg-theme-secondary hover:border-accent transition-all flex items-center gap-4"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="p-3 bg-accent/20 rounded-lg">
                                <Link className="text-accent" size={24} />
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-theme-primary">I have an existing account</p>
                                <p className="text-sm text-theme-secondary">Link my Plex to my Framerr account</p>
                            </div>
                        </motion.button>

                        <motion.button
                            onClick={() => setMode('create-new')}
                            className="w-full p-4 rounded-xl border-2 border-theme bg-theme-secondary hover:border-accent transition-all flex items-center gap-4"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="p-3 bg-accent/20 rounded-lg">
                                <UserPlus className="text-accent" size={24} />
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-theme-primary">Create new account</p>
                                <p className="text-sm text-theme-secondary">I&apos;m new to Framerr</p>
                            </div>
                        </motion.button>

                        <button
                            onClick={() => navigate('/login')}
                            className="w-full py-3 text-theme-secondary hover:text-theme-primary transition-colors text-sm flex items-center justify-center gap-2"
                        >
                            <ArrowLeft size={16} />
                            Back to Login
                        </button>
                    </div>
                )}

                {/* Link existing account form */}
                {mode === 'link-existing' && (
                    <form onSubmit={handleLinkExisting} className="space-y-5">
                        <p className="text-theme-secondary text-sm mb-4">
                            Enter your existing Framerr credentials to link your Plex account.
                        </p>

                        <div>
                            <label className="block mb-2 text-sm font-medium text-theme-primary">Username</label>
                            <div className="relative">
                                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full py-3.5 px-4 pl-12 bg-theme-primary border-2 border-theme rounded-xl text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-all"
                                    placeholder="Your Framerr username"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block mb-2 text-sm font-medium text-theme-primary">Password</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full py-3.5 px-4 pl-12 bg-theme-primary border-2 border-theme rounded-xl text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-all"
                                    placeholder="Your password"
                                />
                            </div>
                        </div>

                        <motion.button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 px-4 bg-accent text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2"
                            style={{ boxShadow: '0 4px 14px var(--accent-glow)' }}
                            whileHover={!loading ? { scale: 1.02 } : {}}
                            whileTap={!loading ? { scale: 0.98 } : {}}
                        >
                            {loading ? (
                                <>
                                    <Loader className="animate-spin" size={20} />
                                    Linking...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={20} />
                                    Link & Sign In
                                </>
                            )}
                        </motion.button>

                        <button
                            type="button"
                            onClick={() => { setMode('choose'); setError(''); }}
                            className="w-full py-3 text-theme-secondary hover:text-theme-primary transition-colors text-sm flex items-center justify-center gap-2"
                        >
                            <ArrowLeft size={16} />
                            Back
                        </button>
                    </form>
                )}

                {/* Create new account form */}
                {mode === 'create-new' && (
                    <form onSubmit={handleCreateAccount} className="space-y-5">
                        <p className="text-theme-secondary text-sm mb-4">
                            Create your Framerr account. You&apos;ll be able to sign in with Plex or your password.
                        </p>

                        <div>
                            <label className="block mb-2 text-sm font-medium text-theme-primary">Username</label>
                            <div className="relative">
                                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full py-3.5 px-4 pl-12 bg-theme-primary border-2 border-theme rounded-xl text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-all"
                                    placeholder="Choose a username"
                                />
                            </div>
                            <p className="mt-1 text-xs text-theme-tertiary">Pre-filled from Plex - you can change it</p>
                        </div>

                        <div>
                            <label className="block mb-2 text-sm font-medium text-theme-primary">Password</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full py-3.5 px-4 pl-12 bg-theme-primary border-2 border-theme rounded-xl text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-all"
                                    placeholder="Choose a password"
                                />
                            </div>
                            <p className="mt-1 text-xs text-theme-tertiary">Minimum 8 characters</p>
                        </div>

                        <div>
                            <label className="block mb-2 text-sm font-medium text-theme-primary">Confirm Password</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full py-3.5 px-4 pl-12 bg-theme-primary border-2 border-theme rounded-xl text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-all"
                                    placeholder="Confirm your password"
                                />
                            </div>
                        </div>

                        <motion.button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 px-4 bg-accent text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2"
                            style={{ boxShadow: '0 4px 14px var(--accent-glow)' }}
                            whileHover={!loading ? { scale: 1.02 } : {}}
                            whileTap={!loading ? { scale: 0.98 } : {}}
                        >
                            {loading ? (
                                <>
                                    <Loader className="animate-spin" size={20} />
                                    Creating Account...
                                </>
                            ) : (
                                <>
                                    <UserPlus size={20} />
                                    Create Account
                                </>
                            )}
                        </motion.button>

                        <button
                            type="button"
                            onClick={() => { setMode('choose'); setError(''); }}
                            className="w-full py-3 text-theme-secondary hover:text-theme-primary transition-colors text-sm flex items-center justify-center gap-2"
                        >
                            <ArrowLeft size={16} />
                            Back
                        </button>
                    </form>
                )}
            </motion.div>
        </div>
    );
};

export default PlexSetup;

/**
 * SSO Setup Page
 * Shown to new SSO users who need to create or link a Framerr account.
 * Works with any SSO provider (Plex, OIDC, etc.)
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { showLoginSplash } from '../../utils/splash';
import { Lock, User, AlertCircle, Loader, ArrowLeft, Link, UserPlus, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// Provider display configuration
const PROVIDER_CONFIG: Record<string, { name: string; color: string; glowColor: string }> = {
    plex: { name: 'Plex', color: '#e5a00d', glowColor: 'rgba(229, 160, 13, 0.3)' },
    oidc: { name: 'SSO', color: 'var(--accent)', glowColor: 'var(--accent-glow)' }
};

function getProviderConfig(provider: string) {
    return PROVIDER_CONFIG[provider] || { name: provider, color: 'var(--accent)', glowColor: 'var(--accent-glow)' };
}

interface SSOUser {
    username: string;
    email: string | null;
    avatar: string | null;
}

type SetupMode = 'choose' | 'link-existing' | 'create-new';

const SSOSetup = (): React.JSX.Element => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { success: showSuccess, error: showError } = useNotifications();
    const { checkAuth } = useAuth();

    // Token and SSO user state
    const [token] = useState(searchParams.get('token') || '');
    const [provider, setProvider] = useState<string>('');
    const [ssoUser, setSsoUser] = useState<SSOUser | null>(null);
    const [validating, setValidating] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);

    // Setup mode
    const [mode, setMode] = useState<SetupMode>('choose');

    // Link existing form state
    const [linkUsername, setLinkUsername] = useState('');
    const [linkPassword, setLinkPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Create new form state
    const [newUsername, setNewUsername] = useState('');

    // Shared state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Prevent duplicate validation in strict mode
    const validated = useRef(false);

    // Validate token on mount
    useEffect(() => {
        const validateToken = async (): Promise<void> => {
            if (!token || validated.current) {
                if (!token) {
                    setValidating(false);
                    setError('No setup token provided');
                }
                return;
            }

            validated.current = true;

            try {
                const response = await axios.post('/api/auth/sso-setup/validate', { token });
                if (response.data.valid) {
                    setTokenValid(true);
                    setProvider(response.data.provider);
                    setSsoUser(response.data.ssoUser);
                    setNewUsername(response.data.ssoUser.username || '');
                } else {
                    setError('Invalid or expired setup token');
                }
            } catch {
                setError('Failed to validate setup token. Please try logging in again.');
            } finally {
                setValidating(false);
            }
        };

        validateToken();
    }, [token]);

    const providerConfig = getProviderConfig(provider);

    // Handle link existing account
    const handleLinkExisting = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post('/api/auth/sso-setup/link-existing', {
                setupToken: token,
                username: linkUsername,
                password: linkPassword
            });

            if (response.data.success) {
                showSuccess('Account Linked!', `Your ${providerConfig.name} account has been connected`);
                await checkAuth();
                showLoginSplash();
                navigate('/', { replace: true });
            }
        } catch (err) {
            const apiError = err as { response?: { data?: { error?: string } } };
            setError(apiError.response?.data?.error || 'Failed to link account');
        } finally {
            setLoading(false);
        }
    };

    // Handle create new account — username only, no password
    const handleCreateAccount = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setError('');

        if (newUsername.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('/api/auth/sso-setup/create-account', {
                setupToken: token,
                username: newUsername
            });

            if (response.data.success) {
                showSuccess('Account Created!', `Welcome to Framerr, ${newUsername}!`);
                await checkAuth();
                showLoginSplash();
                navigate('/', { replace: true });
            }
        } catch (err) {
            const apiError = err as { response?: { data?: { error?: string } } };
            setError(apiError.response?.data?.error || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    // Loading state
    if (validating) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-theme-primary">
                <motion.div
                    className="flex flex-col items-center gap-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                        <Loader size={32} className="text-accent" />
                    </motion.div>
                    <p className="text-theme-secondary">Validating setup token...</p>
                </motion.div>
            </div>
        );
    }

    // Invalid token state
    if (!tokenValid || !ssoUser) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-theme-primary p-4">
                <motion.div
                    className="w-full max-w-md mx-auto glass-subtle p-10 rounded-2xl shadow-xl border border-theme text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ backgroundColor: 'var(--error-bg, rgba(239, 68, 68, 0.1))' }}>
                        <AlertCircle size={28} style={{ color: 'var(--error)' }} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-theme-primary">Setup Token Invalid</h2>
                    <p className="text-theme-secondary mb-6">
                        {error || 'This link has expired or has already been used.'}
                    </p>
                    <button
                        onClick={() => navigate('/login', { replace: true })}
                        className="px-6 py-3 bg-accent text-white rounded-xl font-semibold shadow-lg"
                        style={{ boxShadow: '0 4px 14px var(--accent-glow)' }}
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
                transition={{ type: 'spring', stiffness: 220, damping: 30 }}
            >
                {/* Header */}
                <div className="text-center mb-8">
                    {ssoUser.avatar && (
                        <motion.img
                            src={ssoUser.avatar}
                            alt={ssoUser.username}
                            className="w-16 h-16 rounded-full mx-auto mb-4 border-2 border-theme"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                        />
                    )}
                    {!ssoUser.avatar && (
                        <motion.div
                            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                            style={{ backgroundColor: providerConfig.color, boxShadow: `0 0 30px ${providerConfig.glowColor}` }}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <User size={28} className="text-white" />
                        </motion.div>
                    )}
                    <motion.h2
                        className="text-2xl font-bold mb-1 text-theme-primary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        Set Up Your Account
                    </motion.h2>
                    <motion.p
                        className="text-theme-secondary text-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        Signed in to <span className="font-semibold" style={{ color: providerConfig.color }}>{providerConfig.name}</span> as{' '}
                        <span className="font-semibold text-theme-primary">{ssoUser.username}</span>
                    </motion.p>
                </div>

                {/* Error */}
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
                            animate={{ opacity: 1, y: 0, x: [0, -5, 5, -5, 5, 0] }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{
                                opacity: { duration: 0.2 },
                                y: { type: 'spring', stiffness: 220, damping: 30 },
                                x: { duration: 0.4 }
                            }}
                        >
                            <AlertCircle size={18} />
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {/* Choose Mode */}
                    {mode === 'choose' && (
                        <motion.div
                            key="choose"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                            className="space-y-4"
                        >
                            <motion.button
                                onClick={() => { setMode('create-new'); setError(''); }}
                                className="w-full p-4 rounded-xl border border-theme bg-theme-secondary flex items-center gap-4 text-left transition-colors"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                                    <UserPlus size={20} className="text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold text-theme-primary">Create New Account</p>
                                    <p className="text-sm text-theme-tertiary">Set up a new Framerr account</p>
                                </div>
                            </motion.button>

                            <motion.button
                                onClick={() => { setMode('link-existing'); setError(''); }}
                                className="w-full p-4 rounded-xl border border-theme bg-theme-secondary flex items-center gap-4 text-left transition-colors"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: providerConfig.color }}>
                                    <Link size={20} className="text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold text-theme-primary">I Have an Existing Account</p>
                                    <p className="text-sm text-theme-tertiary">Link your {providerConfig.name} to your Framerr account</p>
                                </div>
                            </motion.button>
                        </motion.div>
                    )}

                    {/* Link Existing Mode */}
                    {mode === 'link-existing' && (
                        <motion.div
                            key="link-existing"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                        >
                            <button
                                onClick={() => { setMode('choose'); setError(''); }}
                                className="flex items-center gap-2 text-sm text-theme-secondary mb-6 transition-colors"
                                style={{ cursor: 'pointer' }}
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>

                            <h3 className="text-lg font-semibold text-theme-primary mb-1">Link Existing Account</h3>
                            <p className="text-sm text-theme-tertiary mb-6">
                                Enter your Framerr credentials to connect your {providerConfig.name} account.
                            </p>

                            <form onSubmit={handleLinkExisting}>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-medium text-theme-primary">Username</label>
                                    <div className="relative">
                                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                                        <input
                                            type="text"
                                            value={linkUsername}
                                            onChange={(e) => setLinkUsername(e.target.value)}
                                            required
                                            className="w-full py-3.5 px-4 pl-12 bg-theme-primary border-2 border-theme rounded-xl text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-all"
                                            placeholder="Enter your username"
                                        />
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <label className="block mb-2 text-sm font-medium text-theme-primary">Password</label>
                                    <div className="relative">
                                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={linkPassword}
                                            onChange={(e) => setLinkPassword(e.target.value)}
                                            required
                                            className="w-full py-3.5 px-4 pl-12 pr-12 bg-theme-primary border-2 border-theme rounded-xl text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-all"
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

                                <motion.button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full py-4 px-4 rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 text-white ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    style={{ backgroundColor: providerConfig.color, boxShadow: loading ? 'none' : `0 4px 14px ${providerConfig.glowColor}` }}
                                    whileHover={!loading ? { scale: 1.02 } : {}}
                                    whileTap={!loading ? { scale: 0.98 } : {}}
                                >
                                    {loading ? (
                                        <>
                                            <Loader className="animate-spin" size={20} />
                                            Linking account...
                                        </>
                                    ) : (
                                        <>
                                            <Link size={20} />
                                            Link & Sign In
                                        </>
                                    )}
                                </motion.button>
                            </form>
                        </motion.div>
                    )}

                    {/* Create New Mode — username only, no password */}
                    {mode === 'create-new' && (
                        <motion.div
                            key="create-new"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                        >
                            <button
                                onClick={() => { setMode('choose'); setError(''); }}
                                className="flex items-center gap-2 text-sm text-theme-secondary mb-6 transition-colors"
                                style={{ cursor: 'pointer' }}
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>

                            <h3 className="text-lg font-semibold text-theme-primary mb-1">Create Your Account</h3>
                            <p className="text-sm text-theme-tertiary mb-6">
                                Choose a username for your Framerr account. You can set a local password later in Settings.
                            </p>

                            <form onSubmit={handleCreateAccount}>
                                <div className="mb-6">
                                    <label className="block mb-2 text-sm font-medium text-theme-primary">Username</label>
                                    <div className="relative">
                                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                                        <input
                                            type="text"
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value)}
                                            required
                                            minLength={3}
                                            className="w-full py-3.5 px-4 pl-12 bg-theme-primary border-2 border-theme rounded-xl text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-all"
                                            placeholder="Choose a username"
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-theme-tertiary">
                                        Minimum 3 characters. Pre-filled from your {providerConfig.name} username.
                                    </p>
                                </div>

                                <motion.button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full py-4 px-4 bg-accent text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    style={{ boxShadow: loading ? 'none' : '0 4px 14px var(--accent-glow)' }}
                                    whileHover={!loading ? { scale: 1.02, boxShadow: '0 6px 20px var(--accent-glow)' } : {}}
                                    whileTap={!loading ? { scale: 0.98 } : {}}
                                >
                                    {loading ? (
                                        <>
                                            <Loader className="animate-spin" size={20} />
                                            Creating account...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus size={20} />
                                            Create Account & Sign In
                                        </>
                                    )}
                                </motion.button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default SSOSetup;

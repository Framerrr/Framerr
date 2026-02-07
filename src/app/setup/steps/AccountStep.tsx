import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, User, Lock, AlertCircle, Loader } from 'lucide-react';
import type { WizardData } from '../SetupWizard';

interface AccountStepProps {
    data: WizardData;
    updateData: (updates: Partial<WizardData>) => void;
    goNext: () => void;
    goBack: () => void;
    loading: boolean;
    error: string | null;
    createAccount: () => Promise<boolean>;
}

const AccountStep: React.FC<AccountStepProps> = ({
    data,
    updateData,
    goNext,
    goBack,
    loading,
    error,
    createAccount
}) => {
    const [confirmPassword, setConfirmPassword] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        // Validation
        if (!data.username.trim()) {
            setLocalError('Username is required');
            return;
        }

        if (data.password.length < 6) {
            setLocalError('Password must be at least 6 characters');
            return;
        }

        if (data.password !== confirmPassword) {
            setLocalError('Passwords do not match');
            return;
        }

        // Create account and proceed
        const success = await createAccount();
        if (success) {
            goNext();
        }
    };

    const displayError = localError || error;

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
                    <User size={24} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-theme-primary mb-2">
                    Create Admin Account
                </h2>
                <p className="text-theme-secondary">
                    Set up your administrator credentials
                </p>
            </motion.div>

            {/* Error message */}
            {displayError && (
                <motion.div
                    className="p-3 rounded-lg mb-6 flex items-center gap-2 text-sm border"
                    style={{
                        backgroundColor: 'var(--error-bg, rgba(239, 68, 68, 0.1))',
                        borderColor: 'var(--error-border, rgba(239, 68, 68, 0.2))',
                        color: 'var(--error)'
                    }}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <AlertCircle size={16} />
                    {displayError}
                </motion.div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Username */}
                <motion.div
                    className="mb-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <label className="block mb-2 text-sm font-medium text-theme-primary">
                        Username
                    </label>
                    <div className="relative">
                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                        <input
                            type="text"
                            value={data.username}
                            onChange={(e) => updateData({ username: e.target.value })}
                            className="w-full py-3 px-4 pl-11 bg-theme-primary border-2 border-theme rounded-lg text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-colors"
                            placeholder="Choose a username"
                            autoFocus
                        />
                    </div>
                </motion.div>

                {/* Display Name */}
                <motion.div
                    className="mb-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                >
                    <label className="block mb-2 text-sm font-medium text-theme-primary">
                        Display Name <span className="text-theme-tertiary">(optional)</span>
                    </label>
                    <div className="relative">
                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                        <input
                            type="text"
                            value={data.displayName}
                            onChange={(e) => updateData({ displayName: e.target.value })}
                            className="w-full py-3 px-4 pl-11 bg-theme-primary border-2 border-theme rounded-lg text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-colors"
                            placeholder="How should we greet you?"
                        />
                    </div>
                </motion.div>

                {/* Password */}
                <motion.div
                    className="mb-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <label className="block mb-2 text-sm font-medium text-theme-primary">
                        Password
                    </label>
                    <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                        <input
                            type="password"
                            value={data.password}
                            onChange={(e) => updateData({ password: e.target.value })}
                            className="w-full py-3 px-4 pl-11 bg-theme-primary border-2 border-theme rounded-lg text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-colors"
                            placeholder="Create a password"
                        />
                    </div>
                    <p className="text-xs text-theme-tertiary mt-1">At least 6 characters</p>
                </motion.div>

                {/* Confirm Password */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                >
                    <label className="block mb-2 text-sm font-medium text-theme-primary">
                        Confirm Password
                    </label>
                    <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full py-3 px-4 pl-11 bg-theme-primary border-2 border-theme rounded-lg text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-colors"
                            placeholder="Confirm your password"
                        />
                    </div>
                </motion.div>

                {/* Navigation */}
                <div className="flex justify-between">
                    <motion.button
                        type="button"
                        onClick={goBack}
                        className="px-4 py-2 text-theme-secondary hover:text-theme-primary flex items-center gap-2 transition-colors"
                        whileHover={{ x: -4 }}
                        disabled={loading}
                    >
                        <ArrowLeft size={18} />
                        Back
                    </motion.button>

                    <motion.button
                        type="submit"
                        disabled={loading}
                        className={`px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        whileHover={!loading ? { scale: 1.02 } : {}}
                        whileTap={!loading ? { scale: 0.98 } : {}}
                    >
                        {loading ? (
                            <>
                                <Loader size={18} className="animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                Create Account
                                <ArrowRight size={18} />
                            </>
                        )}
                    </motion.button>
                </div>
            </form>
        </div>
    );
};

export default AccountStep;

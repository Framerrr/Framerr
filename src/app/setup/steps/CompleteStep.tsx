import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import type { WizardData } from '../SetupWizard';

interface CompleteStepProps {
    data: WizardData;
    complete: () => void;
}

const CompleteStep: React.FC<CompleteStepProps> = ({ data, complete }) => {
    return (
        <div className="text-center">
            {/* Success animation */}
            <motion.div
                className="mb-8"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 15,
                    delay: 0.1
                }}
            >
                <div
                    className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto"
                    style={{ boxShadow: '0 0 40px rgba(16, 185, 129, 0.3)' }}
                >
                    <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                    >
                        <CheckCircle size={48} className="text-success" />
                    </motion.div>
                </div>
            </motion.div>

            {/* Title */}
            <motion.h1
                className="text-3xl font-bold text-theme-primary mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                Setup Complete! 🎉
            </motion.h1>

            {/* Summary */}
            <motion.div
                className="glass-subtle p-6 rounded-xl border border-theme text-left mb-8 max-w-md mx-auto"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <h3 className="text-sm font-medium text-theme-secondary mb-4 flex items-center gap-2">
                    <Sparkles size={16} className="text-accent" />
                    What's configured:
                </h3>

                <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-3">
                        <CheckCircle size={16} className="text-success flex-shrink-0" />
                        <span className="text-theme-primary">
                            Admin account: <span className="text-accent">{data.username}</span>
                        </span>
                    </li>

                    <li className="flex items-center gap-3">
                        <CheckCircle size={16} className="text-success flex-shrink-0" />
                        <span className="text-theme-primary">
                            Theme: <span className="text-accent capitalize">{data.theme.replace('-', ' ')}</span>
                        </span>
                    </li>

                    {data.appName !== 'Framerr' && (
                        <li className="flex items-center gap-3">
                            <CheckCircle size={16} className="text-success flex-shrink-0" />
                            <span className="text-theme-primary">
                                App name: <span className="text-accent">{data.appName}</span>
                            </span>
                        </li>
                    )}

                    {data.flattenUI && (
                        <li className="flex items-center gap-3">
                            <CheckCircle size={16} className="text-success flex-shrink-0" />
                            <span className="text-theme-primary">
                                Flatten UI enabled
                            </span>
                        </li>
                    )}

                    {data.plexSSOEnabled && (
                        <li className="flex items-center gap-3">
                            <CheckCircle size={16} className="text-success flex-shrink-0" />
                            <span className="text-theme-primary">
                                Plex SSO connected
                            </span>
                        </li>
                    )}
                </ul>
            </motion.div>

            {/* Go to Dashboard button */}
            <motion.button
                onClick={complete}
                className="px-8 py-4 bg-accent hover:bg-accent-hover text-white rounded-xl font-semibold text-lg flex items-center gap-3 mx-auto shadow-lg"
                style={{ boxShadow: '0 4px 20px var(--accent-glow)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.05, boxShadow: '0 6px 30px var(--accent-glow)' }}
                whileTap={{ scale: 0.98 }}
            >
                Go to Dashboard
                <ArrowRight size={20} />
            </motion.button>

            <motion.p
                className="text-xs text-theme-tertiary mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
            >
                You can change any of these settings later in Settings
            </motion.p>
        </div>
    );
};

export default CompleteStep;

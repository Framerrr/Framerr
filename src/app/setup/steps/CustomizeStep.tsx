import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Settings, Loader } from 'lucide-react';
import { Switch } from '@/shared/ui';
import type { WizardData } from '../SetupWizard';

interface CustomizeStepProps {
    data: WizardData;
    updateData: (updates: Partial<WizardData>) => void;
    goNext: () => void;
    goBack: () => void;
    skip: () => void;
    loading: boolean;
    error: string | null;
    saveCustomization: () => Promise<boolean>;
}

const CustomizeStep: React.FC<CustomizeStepProps> = ({
    data,
    updateData,
    goNext,
    goBack,
    skip,
    loading,
    saveCustomization
}) => {
    const [saving, setSaving] = useState(false);

    // Apply flattenUI immediately to document for instant visual feedback
    useEffect(() => {
        if (data.flattenUI) {
            document.documentElement.classList.add('flatten-ui');
        } else {
            document.documentElement.classList.remove('flatten-ui');
        }
    }, [data.flattenUI]);

    const handleNext = async () => {
        setSaving(true);
        const success = await saveCustomization();
        setSaving(false);
        if (success) {
            goNext();
        }
    };

    const handleSkip = () => {
        // Use defaults
        skip();
    };

    const isLoading = loading || saving;

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
                    <Settings size={24} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-theme-primary mb-2">
                    Customize Your Dashboard
                </h2>
                <p className="text-theme-secondary">
                    Make it yours
                </p>
            </motion.div>

            {/* App Name */}
            <motion.div
                className="mb-6"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
            >
                <label className="block mb-2 text-sm font-medium text-theme-primary">
                    App Name
                </label>
                <input
                    type="text"
                    value={data.appName}
                    onChange={(e) => updateData({ appName: e.target.value })}
                    className="w-full py-3 px-4 bg-theme-primary border-2 border-theme rounded-lg text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-colors"
                    placeholder="Framerr"
                />
                <p className="text-xs text-theme-tertiary mt-1">
                    Shown in the browser title and header
                </p>
            </motion.div>

            {/* Flatten UI Toggle */}
            <motion.div
                className="mb-8 p-4 rounded-xl bg-theme-tertiary/30"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
            >
                <label className="flex items-center justify-between cursor-pointer">
                    <div>
                        <span className="text-sm font-medium text-theme-primary block">
                            Flatten UI
                        </span>
                        <span className="text-xs text-theme-tertiary">
                            Remove glassmorphism effects for a cleaner look
                        </span>
                    </div>
                    <Switch
                        checked={data.flattenUI}
                        onCheckedChange={(checked: boolean) => updateData({ flattenUI: checked })}
                    />
                </label>
            </motion.div>

            {/* Preview */}
            <motion.div
                className="mb-8 p-4 rounded-xl border border-theme"
                style={data.flattenUI ? {} : {
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(12px)'
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <div className="text-xs text-theme-tertiary mb-2">Preview</div>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent"></div>
                    <span className="font-semibold text-theme-primary">
                        {data.appName || 'Framerr'}
                    </span>
                </div>
            </motion.div>

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
                        onClick={handleSkip}
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
                        {isLoading ? (
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

export default CustomizeStep;

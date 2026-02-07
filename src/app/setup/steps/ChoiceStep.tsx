import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, RotateCcw, ArrowRight, ArrowLeft } from 'lucide-react';
import type { WizardData } from '../SetupWizard';

interface ChoiceStepProps {
    data: WizardData;
    updateData: (updates: Partial<WizardData>) => void;
    goNext: () => void;
    goBack: () => void;
    onRestoreChoice: () => void;
}

const ChoiceStep: React.FC<ChoiceStepProps> = ({ goNext, goBack, onRestoreChoice }) => {
    return (
        <div className="glass-subtle p-8 rounded-2xl border border-theme">
            {/* Header */}
            <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h2 className="text-2xl font-bold text-theme-primary mb-2">
                    How would you like to start?
                </h2>
                <p className="text-theme-secondary">
                    Create a fresh dashboard or restore from an existing backup
                </p>
            </motion.div>

            {/* Options */}
            <div className="space-y-3 max-w-sm mx-auto">
                {/* New Instance Option */}
                <motion.button
                    onClick={goNext}
                    className="w-full p-4 rounded-xl bg-theme-secondary border border-theme-light hover:border-accent/50 hover:bg-theme-hover text-left group"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors duration-150">
                            <Rocket size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-theme-primary text-lg">Create New Instance</h3>
                            <p className="text-sm text-theme-secondary">Set up a fresh Framerr dashboard</p>
                        </div>
                        <ArrowRight size={20} className="text-theme-tertiary group-hover:text-accent transition-colors duration-150" />
                    </div>
                </motion.button>

                {/* Restore Option */}
                <motion.button
                    onClick={onRestoreChoice}
                    className="w-full p-4 rounded-xl bg-theme-secondary border border-theme-light hover:border-accent/50 hover:bg-theme-hover text-left group"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-theme-tertiary text-theme-secondary group-hover:bg-accent group-hover:text-white transition-colors duration-150">
                            <RotateCcw size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-theme-primary text-lg">Restore from Backup</h3>
                            <p className="text-sm text-theme-secondary">Import an existing Framerr backup</p>
                        </div>
                        <ArrowRight size={20} className="text-theme-tertiary group-hover:text-accent transition-colors duration-150" />
                    </div>
                </motion.button>
            </div>

            {/* Back button - matches AccountStep pattern */}
            <div className="flex justify-start mt-6">
                <motion.button
                    type="button"
                    onClick={goBack}
                    className="px-4 py-2 text-theme-secondary hover:text-theme-primary flex items-center gap-2 transition-colors"
                    whileHover={{ x: -4 }}
                >
                    <ArrowLeft size={18} />
                    Back
                </motion.button>
            </div>
        </div>
    );
};

export default ChoiceStep;

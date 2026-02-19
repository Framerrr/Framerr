import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { WizardData } from '../SetupWizard';

interface WelcomeStepProps {
    data: WizardData;
    updateData: (updates: Partial<WizardData>) => void;
    goNext: () => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ goNext }) => {
    return (
        <div className="text-center">
            {/* Logo with entrance animation */}
            <motion.div
                className="mb-8"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 20,
                    delay: 0.2
                }}
            >
                <div
                    className="w-24 h-24 mx-auto rounded-[14px] overflow-hidden"
                    style={{ boxShadow: '0 0 40px var(--accent-glow)' }}
                >
                    <img
                        src="/framerr-logo.png"
                        alt="Framerr"
                        className="w-full h-full object-cover"
                        style={{ transform: 'scale(1.22)' }}
                    />
                </div>
            </motion.div>

            {/* Title */}
            <motion.h1
                className="text-4xl font-bold text-theme-primary mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                Welcome to{' '}
                <span className="text-accent">Framerr</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
                className="text-lg text-theme-secondary mb-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                Let's get your dashboard set up
            </motion.p>

            {/* Get Started button */}
            <motion.button
                onClick={goNext}
                className="px-8 py-4 bg-accent hover:bg-accent-hover text-white rounded-xl font-semibold text-lg flex items-center gap-3 mx-auto shadow-lg"
                style={{ boxShadow: '0 4px 20px var(--accent-glow)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ scale: 1.05, boxShadow: '0 6px 30px var(--accent-glow)' }}
                whileTap={{ scale: 0.98 }}
            >
                Get Started
                <ArrowRight size={20} />
            </motion.button>
        </div>
    );
};

export default WelcomeStep;

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import type { WizardData } from '../SetupWizard';

interface ThemeStepProps {
    data: WizardData;
    updateData: (updates: Partial<WizardData>) => void;
    goNext: () => void;
    skip: () => void;
    triggerRipple: (x: number, y: number, color: string) => void;
}

// Theme definitions with preview colors
const THEMES = [
    { id: 'dark-pro', name: 'Dark Pro', bg: '#0a0e1a', accent: '#3b82f6', text: '#f1f5f9' },
    { id: 'nord', name: 'Nord', bg: '#2e3440', accent: '#88c0d0', text: '#eceff4' },
    { id: 'catppuccin', name: 'Catppuccin', bg: '#1e1e2e', accent: '#cba6f7', text: '#cdd6f4' },
    { id: 'dracula', name: 'Dracula', bg: '#282a36', accent: '#bd93f9', text: '#f8f8f2' },
    { id: 'light', name: 'Light', bg: '#ffffff', accent: '#3b82f6', text: '#1a1a1a' },
    { id: 'noir', name: 'Noir', bg: '#0a0a0a', accent: '#a1a1aa', text: '#fafafa' },
    { id: 'nebula', name: 'Nebula', bg: '#0d0221', accent: '#c084fc', text: '#e9d5ff' }
];

const ThemeStep: React.FC<ThemeStepProps> = ({
    data,
    updateData,
    goNext,
    skip,
    triggerRipple
}) => {
    const handleThemeSelect = useCallback((
        themeId: string,
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        const theme = THEMES.find(t => t.id === themeId);
        if (!theme) return;

        // Get click position for ripple
        const rect = event.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        // Trigger ripple with theme background color
        triggerRipple(x, y, theme.bg);

        // Update theme after slight delay (let ripple start)
        setTimeout(() => {
            document.documentElement.setAttribute('data-theme', themeId);
            localStorage.setItem('framerr-theme', themeId);
            updateData({ theme: themeId });
        }, 200);
    }, [triggerRipple, updateData]);

    return (
        <div className="glass-subtle p-8 rounded-2xl border border-theme">
            {/* Header */}
            <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h2 className="text-2xl font-bold text-theme-primary mb-2">
                    Choose Your Theme
                </h2>
                <p className="text-theme-secondary">
                    Pick a look that suits your style
                </p>
            </motion.div>

            {/* Theme grid */}
            <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                {THEMES.map((theme, index) => (
                    <motion.button
                        key={theme.id}
                        onClick={(e) => handleThemeSelect(theme.id, e)}
                        className={`relative p-4 rounded-xl border-2 transition-all ${data.theme === theme.id
                            ? 'border-accent shadow-lg'
                            : 'border-theme hover:border-accent/50'
                            }`}
                        style={{ backgroundColor: theme.bg }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 + index * 0.03 }}
                    >
                        {/* Selected indicator */}
                        {data.theme === theme.id && (
                            <motion.div
                                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 300 }}
                            >
                                <Check size={12} className="text-white" />
                            </motion.div>
                        )}

                        {/* Preview */}
                        <div className="mb-3">
                            <div
                                className="w-full h-2 rounded-full mb-1"
                                style={{ backgroundColor: theme.accent }}
                            />
                            <div
                                className="w-3/4 h-1 rounded-full opacity-50"
                                style={{ backgroundColor: theme.text }}
                            />
                        </div>

                        {/* Name */}
                        <span
                            className="text-sm font-medium"
                            style={{ color: theme.text }}
                        >
                            {theme.name}
                        </span>
                    </motion.button>
                ))}
            </motion.div>

            {/* Navigation */}
            <div className="flex justify-end">
                <div className="flex gap-3">
                    <motion.button
                        onClick={skip}
                        className="px-4 py-2 text-theme-tertiary hover:text-theme-secondary transition-colors"
                    >
                        Skip
                    </motion.button>

                    <motion.button
                        onClick={goNext}
                        className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium flex items-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        Next
                        <ArrowRight size={18} />
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

export default ThemeStep;

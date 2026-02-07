import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThemeRippleProps {
    active: boolean;
    x: number;
    y: number;
    color: string;
}

/**
 * ThemeRipple - Creates a ripple effect when changing themes
 * Expands from click position like a drop of color in water
 */
const ThemeRipple: React.FC<ThemeRippleProps> = ({ active, x, y, color }) => {
    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    className="fixed pointer-events-none z-50"
                    style={{
                        left: x,
                        top: y,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: color,
                        transform: 'translate(-50%, -50%)'
                    }}
                    initial={{
                        scale: 0,
                        opacity: 0.6
                    }}
                    animate={{
                        scale: 300, // Large enough to cover viewport
                        opacity: 0
                    }}
                    exit={{
                        opacity: 0
                    }}
                    transition={{
                        duration: 1.0,
                        ease: [0.25, 0.1, 0.25, 1] // Smoother cubic-bezier
                    }}
                />
            )}
        </AnimatePresence>
    );
};

export default ThemeRipple;

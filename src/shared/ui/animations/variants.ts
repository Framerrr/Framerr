/**
 * Framer Motion Animation Variants
 * 
 * Reusable animation presets for consistent motion across the app.
 * Import and use with framer-motion's motion components.
 * 
 * @example
 * import { motion } from 'framer-motion';
 * import { fadeIn, staggerContainer } from '@/shared/ui/animations';
 * 
 * <motion.div variants={staggerContainer} initial="hidden" animate="visible">
 *   <motion.div variants={fadeIn}>Item 1</motion.div>
 *   <motion.div variants={fadeIn}>Item 2</motion.div>
 * </motion.div>
 */

import type { Variants, Transition } from 'framer-motion';
import { DURATION, EASING, STAGGER } from './constants';

// =============================================================================
// Base Transitions
// =============================================================================

export const gentleTransition: Transition = {
    duration: DURATION.medium,
    ease: EASING.gentle,
};

export const smoothTransition: Transition = {
    duration: DURATION.normal,
    ease: EASING.smooth,
};

// =============================================================================
// Fade Variants
// =============================================================================

/** Simple fade in/out */
export const fade: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: gentleTransition,
    },
    exit: {
        opacity: 0,
        transition: { duration: DURATION.fast },
    },
};

/** Fade in with subtle upward movement (great for page content) */
export const fadeUp: Variants = {
    hidden: {
        opacity: 0,
        y: 8,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: gentleTransition,
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: { duration: DURATION.fast },
    },
};

/** Fade in with subtle downward movement */
export const fadeDown: Variants = {
    hidden: {
        opacity: 0,
        y: -8,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: gentleTransition,
    },
    exit: {
        opacity: 0,
        y: 4,
        transition: { duration: DURATION.fast },
    },
};

// =============================================================================
// Scale Variants
// =============================================================================

/** Scale in from slightly smaller (great for modals, popovers) */
export const scaleIn: Variants = {
    hidden: {
        opacity: 0,
        scale: 0.95,
    },
    visible: {
        opacity: 1,
        scale: 1,
        transition: smoothTransition,
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        transition: { duration: DURATION.fast },
    },
};

// =============================================================================
// Expand/Collapse Variants (for accordions, expandable sections)
// =============================================================================

/** Height expansion with fade */
export const expandCollapse: Variants = {
    hidden: {
        opacity: 0,
        height: 0,
        overflow: 'hidden',
    },
    visible: {
        opacity: 1,
        height: 'auto',
        overflow: 'hidden',
        transition: {
            height: { duration: DURATION.normal, ease: EASING.easeOut },
            opacity: { duration: DURATION.fast, delay: 0.05 },
        },
    },
    exit: {
        opacity: 0,
        height: 0,
        overflow: 'hidden',
        transition: {
            height: { duration: DURATION.normal, ease: EASING.easeIn },
            opacity: { duration: DURATION.fast },
        },
    },
};

// =============================================================================
// Stagger Container Variants (for lists, grids)
// =============================================================================

/** Container that staggers children animations */
export const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: STAGGER.normal,
            delayChildren: 0.1,
        },
    },
};

/** Fast stagger container */
export const staggerContainerFast: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: STAGGER.fast,
            delayChildren: 0.05,
        },
    },
};

// =============================================================================
// Settings-Specific Variants
// =============================================================================

/** Settings page container - subtle stagger for sections */
export const settingsPageContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: STAGGER.slow,
            delayChildren: 0.1,
        },
    },
};

/** Settings section - fade up with gentle timing */
export const settingsSection: Variants = {
    hidden: {
        opacity: 0,
        y: 12,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: DURATION.medium,
            ease: EASING.gentle,
        },
    },
};

/** Settings item - subtle fade for list items */
export const settingsItem: Variants = {
    hidden: {
        opacity: 0,
        x: -4,
    },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            duration: DURATION.normal,
            ease: EASING.easeOut,
        },
    },
};

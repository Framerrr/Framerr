import { Variants, Transition } from 'framer-motion';

/**
 * Animation Presets for Framerr Design System
 * 
 * These presets ensure consistent, subtle animations throughout the app.
 * All animations are designed to be smooth and not distracting.
 */

// ===========================
// Transition Presets
// ===========================

/** 
 * Standard spring transition - used for most UI elements 
 * Feels snappy but not harsh
 */
export const springTransition: Transition = {
    type: 'spring',
    stiffness: 350,
    damping: 35,
    mass: 0.7,
};

/** 
 * Fast spring for quick interactions 
 * Used for button presses, toggles
 */
export const fastSpring: Transition = {
    type: 'spring',
    stiffness: 500,
    damping: 35,
    mass: 0.5,
};

/** 
 * Slow spring for dramatic reveals 
 * Used for page transitions, modal opens
 */
export const slowSpring: Transition = {
    type: 'spring',
    stiffness: 220,
    damping: 30,
    mass: 1,
};

/** 
 * Standard ease for simple fades 
 */
export const easeTransition: Transition = {
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1], // Material Design ease
};

// ===========================
// Animation Variants
// ===========================

/**
 * scaleIn - Modal/Dialog entrance animation
 * 
 * Usage:
 * <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit">
 */
export const scaleIn: Variants = {
    hidden: {
        opacity: 0,
        scale: 0.95,
    },
    visible: {
        opacity: 1,
        scale: 1,
        transition: springTransition,
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.15, ease: 'easeOut' },
    },
};

/**
 * fadeSlideUp - Page/section entrance animation
 * 
 * Usage:
 * <motion.div variants={fadeSlideUp} initial="hidden" animate="visible">
 */
export const fadeSlideUp: Variants = {
    hidden: {
        opacity: 0,
        y: 10,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: slowSpring,
    },
    exit: {
        opacity: 0,
        y: -10,
        transition: { duration: 0.15, ease: 'easeOut' },
    },
};

/**
 * popIn - Popover/Select dropdown animation
 * 
 * Usage:
 * <motion.div variants={popIn} initial="hidden" animate="visible" exit="exit">
 */
export const popIn: Variants = {
    hidden: {
        opacity: 0,
        y: -6,
        scale: 0.97,
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.2,
            ease: [0.25, 0.1, 0.25, 1], // iOS-like smooth ease
        },
    },
    exit: {
        opacity: 0,
        y: -4,
        scale: 0.98,
        transition: {
            duration: 0.18,
            ease: [0.4, 0, 1, 1], // ease-in for natural exit
        },
    },
};

/**
 * fade - Simple opacity animation
 * 
 * Usage:
 * <motion.div variants={fade} initial="hidden" animate="visible" exit="exit">
 */
export const fade: Variants = {
    hidden: {
        opacity: 0,
    },
    visible: {
        opacity: 1,
        transition: easeTransition,
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.1 },
    },
};

/**
 * slideFromRight - Slide in from right (for panels/sidebars)
 */
export const slideFromRight: Variants = {
    hidden: {
        x: '100%',
        opacity: 0,
    },
    visible: {
        x: 0,
        opacity: 1,
        transition: springTransition,
    },
    exit: {
        x: '100%',
        opacity: 0,
        transition: { duration: 0.2, ease: 'easeIn' },
    },
};

/**
 * slideFromLeft - Slide in from left (for cancel button animation)
 */
export const slideFromLeft: Variants = {
    hidden: {
        x: '-100%',
        opacity: 0,
    },
    visible: {
        x: 0,
        opacity: 1,
        transition: fastSpring,
    },
    exit: {
        x: '-100%',
        opacity: 0,
        transition: { duration: 0.15, ease: 'easeIn' },
    },
};

// ===========================
// Stagger Children
// ===========================

/**
 * staggerContainer - Parent container for staggered children
 * 
 * Usage:
 * <motion.div variants={staggerContainer} initial="hidden" animate="visible">
 *   {items.map(item => <motion.div key={item} variants={staggerItem} />)}
 * </motion.div>
 */
export const staggerContainer: Variants = {
    hidden: { opacity: 1 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.02,
        },
    },
};

/**
 * staggerItem - Individual item in staggered list
 */
export const staggerItem: Variants = {
    hidden: {
        opacity: 0,
        y: 8,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: springTransition,
    },
};

// ===========================
// Backdrop
// ===========================

/**
 * backdrop - Modal/overlay backdrop animation
 */
export const backdrop: Variants = {
    hidden: {
        opacity: 0,
    },
    visible: {
        opacity: 1,
        transition: { duration: 0.2 },
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.15, delay: 0.05 },
    },
};

// ===========================
// Settings Page Animations
// ===========================

/** Settings page container - subtle stagger for sections */
export const settingsPageContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
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
            duration: 0.3,
            ease: [0.22, 1, 0.36, 1],
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
            duration: 0.2,
            ease: [0.0, 0.0, 0.2, 1],
        },
    },
};

/** Fade up animation for content */
export const fadeUp: Variants = {
    hidden: {
        opacity: 0,
        y: 8,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.3,
            ease: [0.22, 1, 0.36, 1],
        },
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: { duration: 0.15 },
    },
};

/** Expand/collapse for accordions */
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
            height: { duration: 0.2, ease: [0.0, 0.0, 0.2, 1] },
            opacity: { duration: 0.15, delay: 0.05 },
        },
    },
    exit: {
        opacity: 0,
        height: 0,
        overflow: 'hidden',
        transition: {
            height: { duration: 0.2, ease: [0.4, 0.0, 1, 1] },
            opacity: { duration: 0.15 },
        },
    },
};


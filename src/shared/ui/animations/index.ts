/**
 * Animation Utilities - Barrel Export
 * 
 * Centralized animation system for consistent motion across the app.
 * 
 * @example
 * // Import variants
 * import { fadeUp, staggerContainer, settingsSection } from '@/shared/ui/animations';
 * 
 * // Import constants
 * import { DURATION, EASING } from '@/shared/ui/animations';
 */

// Constants
export { DURATION, EASING, STAGGER } from './constants';

// Framer Motion Variants
export {
    // Transitions
    gentleTransition,
    smoothTransition,

    // Fade variants
    fade,
    fadeUp,
    fadeDown,

    // Scale variants
    scaleIn,

    // Expand/Collapse
    expandCollapse,

    // Stagger containers
    staggerContainer,
    staggerContainerFast,

    // Settings-specific
    settingsPageContainer,
    settingsSection,
    settingsItem,
} from './variants';

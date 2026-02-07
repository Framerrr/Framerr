/**
 * Animation Constants
 * 
 * Centralized timing and easing values for consistent animations.
 */

// Duration presets (in seconds)
export const DURATION = {
    instant: 0.1,
    fast: 0.15,
    normal: 0.2,
    medium: 0.3,
    slow: 0.4,
} as const;

// Easing presets
export const EASING = {
    // Standard easing
    easeOut: [0.0, 0.0, 0.2, 1],
    easeIn: [0.4, 0.0, 1, 1],
    easeInOut: [0.4, 0.0, 0.2, 1],

    // Smooth spring-like
    smooth: [0.25, 0.1, 0.25, 1],

    // Gentle deceleration (great for entry animations)
    gentle: [0.22, 1, 0.36, 1],

    // Bounce effect
    bounce: [0.68, -0.55, 0.265, 1.55],
} as const;

// Stagger delay between items (in seconds)
export const STAGGER = {
    fast: 0.03,
    normal: 0.05,
    slow: 0.08,
} as const;

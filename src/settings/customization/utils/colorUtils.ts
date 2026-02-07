/**
 * Color Utilities for Customization Settings
 * 
 * DOM manipulation functions for theme color management
 */

import type { CustomColors } from '../types';

/**
 * Default color values matching dark-pro.css - 21 customizable variables
 */
export const defaultColors: CustomColors = {
    // Tier 1: Essentials (10)
    'bg-primary': '#0a0e1a',
    'bg-secondary': '#151922',
    'bg-tertiary': '#1f2937',
    'accent': '#3b82f6',
    'accent-secondary': '#06b6d4',
    'text-primary': '#f1f5f9',
    'text-secondary': '#94a3b8',
    'text-tertiary': '#64748b',
    'border': '#374151',
    'border-light': '#1f2937',

    // Tier 2: Status Colors (4)
    'success': '#10b981',
    'warning': '#f59e0b',
    'error': '#ef4444',
    'info': '#3b82f6',

    // Tier 3: Advanced (7)
    'bg-hover': '#374151',
    'accent-hover': '#2563eb',
    'accent-light': '#60a5fa',
    'border-accent': 'rgba(59, 130, 246, 0.3)',
};

/**
 * Get current theme colors from CSS variables
 */
export function getCurrentThemeColors(): CustomColors {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    return {
        // Tier 1: Essentials
        'bg-primary': computedStyle.getPropertyValue('--bg-primary').trim(),
        'bg-secondary': computedStyle.getPropertyValue('--bg-secondary').trim(),
        'bg-tertiary': computedStyle.getPropertyValue('--bg-tertiary').trim(),
        'accent': computedStyle.getPropertyValue('--accent').trim(),
        'accent-secondary': computedStyle.getPropertyValue('--accent-secondary').trim(),
        'text-primary': computedStyle.getPropertyValue('--text-primary').trim(),
        'text-secondary': computedStyle.getPropertyValue('--text-secondary').trim(),
        'text-tertiary': computedStyle.getPropertyValue('--text-tertiary').trim(),
        'border': computedStyle.getPropertyValue('--border').trim(),
        'border-light': computedStyle.getPropertyValue('--border-light').trim(),

        // Tier 2: Status Colors
        'success': computedStyle.getPropertyValue('--success').trim(),
        'warning': computedStyle.getPropertyValue('--warning').trim(),
        'error': computedStyle.getPropertyValue('--error').trim(),
        'info': computedStyle.getPropertyValue('--info').trim(),

        // Tier 3: Advanced
        'bg-hover': computedStyle.getPropertyValue('--bg-hover').trim(),
        'accent-hover': computedStyle.getPropertyValue('--accent-hover').trim(),
        'accent-light': computedStyle.getPropertyValue('--accent-light').trim(),
        'border-accent': computedStyle.getPropertyValue('--border-accent').trim(),
    };
}

/**
 * Apply custom colors to DOM by setting CSS variables
 */
export function applyColorsToDOM(colors: CustomColors): void {
    Object.entries(colors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--${key}`, value);
    });
}

/**
 * Remove all custom color CSS variables to let theme CSS take over
 */
export function removeColorsFromDOM(): void {
    Object.keys(defaultColors).forEach(key => {
        document.documentElement.style.removeProperty(`--${key}`);
    });
}

/**
 * Theme color preview values for theme cards
 */
export const themeColorPreviews: Record<string, { bg: string; accent: string; secondary: string }> = {
    'dark-pro': { bg: '#0a0e1a', accent: '#3b82f6', secondary: '#06b6d4' },
    'light': { bg: '#ffffff', accent: '#0ea5e9', secondary: '#38bdf8' },
    'dracula': { bg: '#282a36', accent: '#bd93f9', secondary: '#ff79c6' },
    'catppuccin': { bg: '#1e1e2e', accent: '#89b4fa', secondary: '#74c7ec' },
    'nord': { bg: '#2e3440', accent: '#88c0d0', secondary: '#81a1c1' },
    'noir': { bg: '#0a0a0a', accent: '#8a9ba8', secondary: '#6b7a87' },
    'nebula': { bg: '#0f0a1a', accent: '#a855f7', secondary: '#22d3ee' },
};

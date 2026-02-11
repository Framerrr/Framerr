/**
 * Splash Screen Controller — Theme Airlock
 *
 * Centralizes all splash screen logic:
 * - Minimum display duration (800ms) for consistent feel
 * - Theme airlock: if splash theme ≠ target theme, transitions behind splash before dismissing
 * - Loading message updates
 * - Smooth fade-out dismissal
 *
 * The splash is a static HTML element in index.html (#framerr-splash).
 * This module bridges React's lifecycle with that DOM element.
 */

// Extend Window to include splash globals set by index.html inline script
declare global {
    interface Window {
        __splashStart?: number;
        __splashTheme?: string;
    }
}

/** Minimum splash duration in ms for consistent feel */
const MIN_SPLASH_MS = 1500;

/** Duration of theme cross-fade transition in ms (matches CSS transition) */
const THEME_TRANSITION_MS = 500;

/** Theme splash color map — must match index.html and server/index.ts */
const THEME_SPLASH_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
    'dark-pro': { bg: '#0a0e1a', text: '#94a3b8', accent: '#3b82f6' },
    'light': { bg: '#ffffff', text: '#6b7280', accent: '#3b82f6' },
    'nord': { bg: '#2e3440', text: '#81a1c1', accent: '#88c0d0' },
    'catppuccin': { bg: '#1e1e2e', text: '#bac2de', accent: '#89b4fa' },
    'dracula': { bg: '#282a36', text: '#e6e6e6', accent: '#bd93f9' },
    'noir': { bg: '#0f0f12', text: '#888888', accent: '#8a9ba8' },
    'nebula': { bg: '#0d0d1a', text: '#94a3b8', accent: '#a855f7' },
};

const DEFAULT_COLORS = THEME_SPLASH_COLORS['dark-pro'];

let dismissed = false;

/**
 * Get the splash element (null if already removed)
 */
function getSplash(): HTMLElement | null {
    return document.getElementById('framerr-splash');
}

/**
 * Update the loading message text on the splash screen
 */
export function setSplashMessage(text: string): void {
    const el = document.getElementById('splash-message');
    if (el) el.textContent = text;
}

/**
 * Transition the splash theme colors smoothly (for airlock).
 * CSS transitions handle the animation — we just update the variables.
 */
function transitionSplashTheme(targetTheme: string, customColors?: Record<string, string>): void {
    let colors: { bg: string; text: string; accent: string };

    if (customColors?.['bg-primary']) {
        // Custom user colors
        colors = {
            bg: customColors['bg-primary'],
            text: customColors['text-secondary'] || DEFAULT_COLORS.text,
            accent: customColors['accent'] || DEFAULT_COLORS.accent,
        };
    } else {
        colors = THEME_SPLASH_COLORS[targetTheme] || DEFAULT_COLORS;
    }

    const root = document.documentElement;
    root.style.setProperty('--splash-bg', colors.bg);
    root.style.setProperty('--splash-text', colors.text);
    root.style.setProperty('--splash-accent', colors.accent);
    root.style.setProperty('--splash-border', colors.text + '33');
}

/**
 * Dismiss the splash screen with fade-out animation.
 * Called only after all readiness conditions are met.
 */
function fadeOutSplash(): void {
    if (dismissed) return;
    dismissed = true;

    const splash = getSplash();
    if (splash) {
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 300);
    }
}

/**
 * Signal that the app is ready. Handles:
 * 1. Minimum display duration
 * 2. Theme airlock (cross-fade if needed)
 * 3. Smooth fade-out
 *
 * @param targetTheme - The theme the app should be showing
 * @param customColors - Optional custom color overrides (for 'custom' theme mode)
 */
export async function signalAppReady(
    targetTheme: string,
    customColors?: Record<string, string>
): Promise<void> {
    if (dismissed) return;

    const splashTheme = window.__splashTheme || 'dark-pro';
    const splashStart = window.__splashStart || performance.now();
    const elapsed = performance.now() - splashStart;

    // Check if theme needs to transition (airlock)
    const needsTransition = splashTheme !== targetTheme;

    if (needsTransition) {
        // Start the cross-fade
        transitionSplashTheme(targetTheme, customColors);

        // Wait for CSS transition to complete
        await delay(THEME_TRANSITION_MS);
    }

    // Enforce minimum splash duration
    const totalElapsed = performance.now() - splashStart;
    const remaining = MIN_SPLASH_MS - totalElapsed;
    if (remaining > 0) {
        await delay(remaining);
    }

    // Fade out
    fadeOutSplash();
}

/**
 * Immediately dismiss splash (for non-authenticated states like login page).
 * Skips minimum duration and airlock checks.
 */
export function dismissSplashImmediate(): void {
    fadeOutSplash();
}

/**
 * Show the splash screen for login transition.
 * Creates a new splash overlay after successful authentication,
 * covering the dashboard loading. signalAppReady() handles dismissal.
 */
export function showLoginSplash(): void {
    dismissed = false;

    // Reset start time so min duration is enforced from NOW
    window.__splashStart = performance.now();

    let splash = getSplash();
    if (!splash) {
        // Recreate splash overlay  
        splash = document.createElement('div');
        splash.id = 'framerr-splash';

        const spinner = document.createElement('div');
        spinner.className = 'spinner';

        const text = document.createElement('div');
        text.className = 'text';
        text.id = 'splash-message';

        // Pick a random loading message
        const msgs = [
            'Warming up the dashboard...',
            'Getting everything ready...',
            'Preparing your dashboard...',
            'Setting things up...',
            'Loading your setup...',
            'Fetching your widgets...',
        ];
        text.textContent = msgs[Math.floor(Math.random() * msgs.length)];

        splash.appendChild(spinner);
        splash.appendChild(text);
        document.body.appendChild(splash);
    }

    // Set theme colors based on current data-theme
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark-pro';
    const colors = THEME_SPLASH_COLORS[currentTheme] || DEFAULT_COLORS;
    const root = document.documentElement;
    root.style.setProperty('--splash-bg', colors.bg);
    root.style.setProperty('--splash-text', colors.text);
    root.style.setProperty('--splash-accent', colors.accent);
    root.style.setProperty('--splash-border', colors.text + '33');
    window.__splashTheme = currentTheme;
}

/**
 * Show the splash screen for logout transition.
 * Creates a new splash overlay if the original was removed,
 * transitions its theme, then calls the provided callback.
 *
 * @param targetTheme - Theme to transition TO (system/admin theme)
 * @param onComplete - Called after transition completes
 */
export async function showLogoutSplash(
    targetTheme: string,
    onComplete: () => void
): Promise<void> {
    dismissed = false;

    // Logout-specific messages
    const logoutMessages = [
        'Signing out...',
        'Clearing session...',
        'Wrapping up...',
        'See you next time...',
    ];

    let splash = getSplash();
    if (!splash) {
        // Recreate splash overlay
        splash = document.createElement('div');
        splash.id = 'framerr-splash';

        const spinner = document.createElement('div');
        spinner.className = 'spinner';

        const text = document.createElement('div');
        text.className = 'text';
        text.id = 'splash-message';
        text.textContent = logoutMessages[0];

        splash.appendChild(spinner);
        splash.appendChild(text);
        document.body.appendChild(splash);
    } else {
        setSplashMessage(logoutMessages[0]);
    }

    // Cycle through logout messages
    let msgIndex = 1;
    const msgInterval = setInterval(() => {
        if (msgIndex < logoutMessages.length) {
            setSplashMessage(logoutMessages[msgIndex]);
            msgIndex++;
        }
    }, 600);

    // Set current theme colors first (instant, no transition)
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark-pro';
    const currentColors = THEME_SPLASH_COLORS[currentTheme] || DEFAULT_COLORS;
    const root = document.documentElement;
    root.style.setProperty('--splash-bg', currentColors.bg);
    root.style.setProperty('--splash-text', currentColors.text);
    root.style.setProperty('--splash-accent', currentColors.accent);
    root.style.setProperty('--splash-border', currentColors.text + '33');

    // Wait for browser to paint the current theme colors before transitioning
    // Double rAF: first schedules for next frame, second ensures paint is committed
    await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    // Now transition to target (system) theme
    transitionSplashTheme(targetTheme);
    await delay(THEME_TRANSITION_MS);

    clearInterval(msgInterval);
    onComplete();
}

/** Get the exported color map (for server-side use or reference) */
export { THEME_SPLASH_COLORS };

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

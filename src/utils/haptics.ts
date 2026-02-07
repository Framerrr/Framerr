/**
 * Haptic Feedback Utility
 * 
 * Provides cross-platform haptic feedback for mobile devices:
 * - iOS 18+: Uses hidden checkbox switch workaround (native haptic)
 * - Android: Uses Vibration API
 * - Desktop: No-op
 */

// Store reference to the hidden haptic trigger elements
let hapticLabel: HTMLLabelElement | null = null;
let hapticCheckbox: HTMLInputElement | null = null;

/**
 * Initialize the haptic feedback system
 * Must be called once when the app mounts (in App.tsx)
 */
export function initHaptics(): void {
    // Only create if not already initialized
    if (hapticCheckbox) return;

    // Create hidden container - use opacity:0 instead of visibility:hidden
    // to ensure the click event still triggers the checkbox
    const container = document.createElement('div');
    container.id = 'haptic-trigger-container';
    container.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: 1px;
        height: 1px;
        opacity: 0;
    `;

    // Create checkbox with switch attribute (iOS 18+ haptic source)
    hapticCheckbox = document.createElement('input');
    hapticCheckbox.type = 'checkbox';
    hapticCheckbox.id = 'haptic-checkbox';
    hapticCheckbox.setAttribute('switch', '');

    // Create label associated with checkbox
    hapticLabel = document.createElement('label');
    hapticLabel.htmlFor = 'haptic-checkbox';
    hapticLabel.id = 'haptic-label';

    // Append to container
    container.appendChild(hapticCheckbox);
    container.appendChild(hapticLabel);

    // Append to body
    document.body.appendChild(container);
}

/**
 * Clean up the haptic feedback system
 * Should be called when the app unmounts
 */
export function cleanupHaptics(): void {
    const container = document.getElementById('haptic-trigger-container');
    if (container) {
        container.remove();
    }
    hapticLabel = null;
    hapticCheckbox = null;
}

/**
 * Detect if the device is iOS
 */
function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Detect if the device supports vibration
 */
function supportsVibration(): boolean {
    return 'vibrate' in navigator;
}

// Track last haptic trigger time for debouncing
let lastHapticTime = 0;
const HAPTIC_COOLDOWN_MS = 100; // Minimum time between haptic triggers

/**
 * Trigger haptic feedback
 * 
 * @param intensity - 'light' | 'medium' | 'heavy' (affects Android vibration duration)
 */
export function triggerHaptic(intensity: 'light' | 'medium' | 'heavy' = 'light'): void {
    // Debounce rapid triggers
    const now = Date.now();
    if (now - lastHapticTime < HAPTIC_COOLDOWN_MS) {
        return;
    }
    lastHapticTime = now;

    // iOS: Use the hidden checkbox trick
    if (isIOS()) {
        if (hapticLabel) {
            hapticLabel.click();
        }
        return;
    }

    // Android/Other: Use Vibration API
    if (supportsVibration()) {
        const durations = {
            light: 10,
            medium: 25,
            heavy: 50
        };
        navigator.vibrate(durations[intensity]);
        return;
    }

    // Desktop or unsupported: No-op (silent)
}

/**
 * Check if haptic feedback is available on this device
 */
export function isHapticAvailable(): boolean {
    return isIOS() || supportsVibration();
}

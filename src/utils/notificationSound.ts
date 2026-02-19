/**
 * Notification Sound Utility
 * 
 * Uses the Web Audio API to play notification sounds without triggering
 * iOS control center / Now Playing media controls.
 * 
 * Key design decisions:
 * - Web Audio API instead of <audio> element to avoid iOS media session
 * - Lazy AudioContext creation (only when first needed)
 * - Audio buffer cached after first fetch/decode (instant subsequent plays)
 * - Context unlocked on first user interaction (iOS autoplay policy)
 */

import logger from './logger';

let audioContext: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let unlocked = false;

const SOUND_URL = '/sounds/notification.mp3';

/**
 * Get or create the AudioContext (lazy singleton).
 */
function getContext(): AudioContext {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    return audioContext;
}

/**
 * Unlock the AudioContext for iOS/Safari.
 * Must be called from a user gesture handler (click, tap, etc.).
 * Safe to call multiple times — only does work on the first call.
 */
export function unlockAudio(): void {
    if (unlocked) return;

    try {
        const ctx = getContext();

        // Resume if suspended (iOS starts in suspended state)
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {
                // Silently ignore — will retry on next interaction
            });
        }

        // Play a silent buffer to fully unlock on iOS
        const silentBuffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(ctx.destination);
        source.start(0);

        unlocked = true;
        logger.debug('[NotificationSound] AudioContext unlocked');
    } catch {
        // AudioContext not supported or failed — sound will silently not work
        logger.debug('[NotificationSound] Failed to unlock AudioContext');
    }
}

/**
 * Load and decode the notification sound MP3.
 * Caches the decoded AudioBuffer for instant subsequent playback.
 */
async function loadSound(): Promise<AudioBuffer | null> {
    if (audioBuffer) return audioBuffer;

    try {
        const ctx = getContext();
        const response = await fetch(SOUND_URL);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        logger.debug('[NotificationSound] Sound loaded and decoded');
        return audioBuffer;
    } catch (error) {
        logger.error('[NotificationSound] Failed to load sound', {
            error: (error as Error).message
        });
        return null;
    }
}

/**
 * Play the notification sound.
 * 
 * - Silently no-ops if AudioContext is not supported or not unlocked
 * - Loads/decodes sound on first call, plays from cache after
 * - Safe to call rapidly — each call creates a new buffer source
 */
export async function playNotificationSound(): Promise<void> {
    try {
        const ctx = getContext();

        // Resume if suspended (can happen after tab backgrounding)
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        const buffer = await loadSound();
        if (!buffer) return;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);

        logger.debug('[NotificationSound] Sound played');
    } catch {
        // Silently fail — sound is non-critical
    }
}

/**
 * Greeting System Types
 *
 * Defines the shape of greeting entries used by the greeting pool and selection engine.
 */

/** Available greeting tones for filtering */
export type GreetingTone = 'standard' | 'witty' | 'nerdy';

/** A single greeting variant */
export interface GreetingEntry {
    /** The greeting text. Use {user} as placeholder for the username. */
    text: string;
    /** Tone category for user filtering */
    tone: GreetingTone;
    /** Optional Lucide icon name (e.g., 'Sun', 'Moon', 'Coffee') */
    icon?: string;
    /** CSS color for the icon. Use theme tokens like 'var(--accent)' or named colors. */
    iconColor?: string;
    /** Valid hour range [startHour, endHour] in 24h format. Omit for any time. */
    hours?: [number, number];
    /** Valid days of the week (0=Sunday, 6=Saturday). Omit for any day. */
    days?: number[];
}

/** Tier configuration with weight and pool of entries */
export interface GreetingTier {
    /** Tier name for readability */
    name: string;
    /** Selection weight (all weights are relative to total) */
    weight: number;
    /** Pool of greetings in this tier */
    entries: GreetingEntry[];
}

/** Result returned by getGreeting() */
export interface GreetingResult {
    /** The resolved greeting text (with username inserted) */
    text: string;
    /** Optional Lucide icon name */
    icon?: string;
    /** CSS color for the icon */
    iconColor?: string;
}

/** A loading screen message */
export interface LoadingMessage {
    /** The loading text. Use {user} as placeholder. Trailing dots will be animated. */
    text: string;
    /** Optional Lucide icon name */
    icon?: string;
    /** CSS color for the icon */
    iconColor?: string;
}

/**
 * Greeting Engine
 *
 * Selects a greeting from the pool based on weighted tiers, time/day constraints, and tone filter.
 * Pure utility — no React dependencies.
 */

import type { GreetingEntry, GreetingResult, GreetingTone, LoadingMessage } from './types';
import { greetingPool, loadingMessages } from './greetingPool';

/**
 * Check if a greeting entry is valid for the current time.
 * Handles overnight hour ranges (e.g., [22, 4] means 10pm to 4am).
 */
function isTimeValid(entry: GreetingEntry, now: Date): boolean {
    const hour = now.getHours();
    const day = now.getDay();

    // Check day constraint
    if (entry.days && entry.days.length > 0) {
        if (!entry.days.includes(day)) return false;
    }

    // Check hour constraint
    if (entry.hours) {
        const [start, end] = entry.hours;
        if (start <= end) {
            // Normal range (e.g., [5, 11])
            if (hour < start || hour > end) return false;
        } else {
            // Overnight range (e.g., [22, 4] means 10pm-4am)
            if (hour < start && hour > end) return false;
        }
    }

    return true;
}

/**
 * Select a random greeting based on weighted tiers, current time/day, and tone filter.
 *
 * @param username  - The user's display name to insert into {user} placeholders
 * @param tones     - Optional array of enabled tones. If omitted, all tones are included.
 * @returns The resolved greeting with text, optional icon, and icon color
 */
export function getGreeting(username: string, tones?: GreetingTone[]): GreetingResult {
    const now = new Date();
    const enabledTones = tones && tones.length > 0 ? tones : ['standard', 'witty', 'nerdy'] as GreetingTone[];

    // Build eligible entries per tier (filtered by tone + time/day)
    const eligibleTiers = greetingPool
        .map(tier => ({
            ...tier,
            entries: tier.entries.filter(entry =>
                enabledTones.includes(entry.tone) && isTimeValid(entry, now)
            ),
        }))
        .filter(tier => tier.entries.length > 0);

    if (eligibleTiers.length === 0) {
        // Absolute fallback — should never happen with a reasonable pool
        return { text: `Welcome back, ${username}` };
    }

    // Weighted random tier selection
    const totalWeight = eligibleTiers.reduce((sum, tier) => sum + tier.weight, 0);
    let roll = Math.random() * totalWeight;
    let selectedTier = eligibleTiers[0];

    for (const tier of eligibleTiers) {
        roll -= tier.weight;
        if (roll <= 0) {
            selectedTier = tier;
            break;
        }
    }

    // Random entry within the selected tier
    const entry = selectedTier.entries[Math.floor(Math.random() * selectedTier.entries.length)];

    // Resolve {user} placeholder
    const text = entry.text.replace(/\{user\}/g, username);

    return {
        text,
        icon: entry.icon,
        iconColor: entry.iconColor,
    };
}

/**
 * Get a random loading message for the dashboard loading screen.
 *
 * @param username - The user's display name to insert into {user} placeholders
 * @returns The resolved loading message with text, optional icon, and icon color
 */
export function getLoadingMessage(username: string): LoadingMessage {
    const msg = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
    return {
        text: msg.text.replace(/\{user\}/g, username),
        icon: msg.icon,
        iconColor: msg.iconColor,
    };
}

export type { GreetingEntry, GreetingResult, GreetingTone, LoadingMessage } from './types';


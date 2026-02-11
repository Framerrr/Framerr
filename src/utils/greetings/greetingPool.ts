/**
 * Greeting Pool
 *
 * All greeting variants organized by rarity tier.
 * To add/remove greetings, just edit the arrays below.
 *
 * Each entry can have:
 *   text       — The greeting. Use {user} for the username placeholder.
 *   tone       — 'standard' | 'witty' | 'nerdy' for user filtering.
 *   icon       — Optional Lucide icon name (e.g., 'Sun', 'Moon')
 *   iconColor  — CSS color for the icon
 *   hours      — [start, end] hour range (24h) when this greeting is valid
 *   days       — Array of valid days (0=Sun, 1=Mon, ..., 6=Sat)
 */

import type { GreetingTier, LoadingMessage } from './types';

export const greetingPool: GreetingTier[] = [

    // ================================================================
    //  COMMON — Time-based (60% chance)
    // ================================================================
    {
        name: 'common',
        weight: 60,
        entries: [
            // Morning (5am - 11am)
            { text: 'Good morning, {user}', tone: 'standard', icon: 'Sun', iconColor: '#f59e0b', hours: [5, 11] },
            { text: 'Rise and shine, {user}', tone: 'standard', icon: 'Sunrise', iconColor: '#fb923c', hours: [5, 11] },

            // Afternoon (12pm - 4pm)
            { text: 'Good afternoon, {user}', tone: 'standard', icon: 'Sun', iconColor: '#f59e0b', hours: [12, 16] },
            { text: 'Afternoon, {user}', tone: 'standard', icon: 'Sun', iconColor: '#f59e0b', hours: [12, 16] },

            // Evening (5pm - 9pm)
            { text: 'Good evening, {user}', tone: 'standard', icon: 'Sunset', iconColor: '#f97316', hours: [17, 21] },
            { text: 'Evening, {user}', tone: 'standard', icon: 'Sunset', iconColor: '#f97316', hours: [17, 21] },

            // Night (10pm - 4am)
            { text: 'Good evening, {user}', tone: 'standard', icon: 'Moon', iconColor: '#818cf8', hours: [22, 4] },
        ],
    },

    // ================================================================
    //  UNCOMMON — Day-aware (20% chance)
    // ================================================================
    {
        name: 'uncommon',
        weight: 20,
        entries: [
            { text: 'Happy Friday, {user}', tone: 'standard', icon: 'PartyPopper', iconColor: 'var(--accent)', days: [5] },
            { text: 'TGIF, {user}!', tone: 'witty', icon: 'PartyPopper', iconColor: 'var(--accent)', days: [5] },
            { text: 'New week, fresh start', tone: 'standard', icon: 'Sparkles', iconColor: 'var(--accent)', days: [1] },
            { text: 'Happy hump day, {user}', tone: 'witty', icon: 'Mountain', iconColor: '#a78bfa', days: [3] },
            { text: 'Almost Friday, {user}', tone: 'witty', icon: 'Clock', iconColor: '#60a5fa', days: [4] },
            { text: 'Sunday vibes, {user}', tone: 'witty', icon: 'Coffee', iconColor: '#a78bfa', days: [0] },
        ],
    },

    // ================================================================
    //  RARE — Personality & dev flavor (15% chance)
    // ================================================================
    {
        name: 'rare',
        weight: 15,
        entries: [
            // Standard personality
            { text: 'Welcome back, {user}', tone: 'standard' },
            { text: 'All systems nominal', tone: 'standard', icon: 'Activity', iconColor: '#34d399' },
            { text: 'Status: operational', tone: 'standard', icon: 'CheckCircle', iconColor: '#34d399' },

            // Witty personality
            { text: 'Your dashboard awaits', tone: 'witty', icon: 'LayoutDashboard', iconColor: 'var(--accent)' },
            { text: 'Another day, another dashboard', tone: 'witty', icon: 'LayoutDashboard', iconColor: 'var(--accent)' },
            { text: 'Dashboard loaded, {user}', tone: 'witty', icon: 'Loader', iconColor: 'var(--accent)' },
            { text: 'New save point reached', tone: 'witty', icon: 'Save', iconColor: '#60a5fa' },

            // Nerdy / dev
            { text: 'Hello, World!', tone: 'nerdy', icon: 'Terminal', iconColor: '#34d399' },
            { text: 'Connection established', tone: 'nerdy', icon: 'Wifi', iconColor: '#34d399' },
            { text: 'No errors found. Welcome, {user}', tone: 'nerdy', icon: 'CircleCheck', iconColor: '#34d399' },
            { text: '200 OK', tone: 'nerdy', icon: 'Globe', iconColor: '#34d399' },
            { text: '> {user} logged in', tone: 'nerdy', icon: 'Terminal', iconColor: '#a78bfa' },
        ],
    },

    // ================================================================
    //  ULTRA RARE — Nerdy, pop culture, fun (5% chance)
    // ================================================================
    {
        name: 'ultraRare',
        weight: 5,
        entries: [
            // Witty
            { text: 'Achievement unlocked: opened dashboard', tone: 'witty', icon: 'Trophy', iconColor: '#f59e0b' },
            { text: '{user} has entered the dashboard', tone: 'witty', icon: 'LogIn', iconColor: '#60a5fa' },
            { text: 'Quest accepted: manage dashboard', tone: 'witty', icon: 'Scroll', iconColor: '#f59e0b' },
            { text: '{user} chose: Dashboard', tone: 'witty', icon: 'Swords', iconColor: '#f97316' },
            { text: '{user} joined the server', tone: 'witty', icon: 'Users', iconColor: '#60a5fa' },
            { text: 'Press F to pay respects to your free time', tone: 'witty', icon: 'Keyboard', iconColor: '#818cf8' },
            { text: "Meanwhile, in {user}'s dashboard...", tone: 'witty', icon: 'Clapperboard', iconColor: '#fb923c' },

            // Nerdy — coding
            { text: 'sudo hello {user}', tone: 'nerdy', icon: 'Terminal', iconColor: '#34d399' },
            { text: '01001000 01101001', tone: 'nerdy', icon: 'Binary', iconColor: '#818cf8' },
            { text: 'git pull origin {user}', tone: 'nerdy', icon: 'GitBranch', iconColor: '#fb923c' },
            { text: 'npm run {user}', tone: 'nerdy', icon: 'Terminal', iconColor: '#34d399' },
            { text: 'while(true) {{ welcome({user}); }}', tone: 'nerdy', icon: 'Code', iconColor: '#60a5fa' },
            { text: "import {user} from 'dashboard'", tone: 'nerdy', icon: 'Code', iconColor: '#a78bfa' },

            // Nerdy — sci-fi / movies
            { text: 'This is the way, {user}', tone: 'nerdy', icon: 'Compass', iconColor: '#f59e0b' },
            { text: 'May the dashboard be with you', tone: 'nerdy', icon: 'Sparkles', iconColor: '#60a5fa' },
            { text: 'I am Groot (I mean, hi {user})', tone: 'nerdy', icon: 'TreePine', iconColor: '#34d399' },
            { text: 'To infinity and beyond, {user}', tone: 'nerdy', icon: 'Rocket', iconColor: '#a78bfa' },
            { text: 'The Matrix has you, {user}', tone: 'nerdy', icon: 'MonitorDot', iconColor: '#34d399' },
            { text: 'Wake up, {user}...', tone: 'nerdy', icon: 'Eye', iconColor: '#34d399' },
        ],
    },
];

// ================================================================
//  LOADING MESSAGES — Shown during dashboard load (separate pool)
// ================================================================
export const loadingMessages: LoadingMessage[] = [
    { text: 'Compiling dashboard...', icon: 'Code', iconColor: '#60a5fa' },
    { text: 'Initializing dashboard...', icon: 'Cpu', iconColor: '#818cf8' },
    { text: 'Deploying dashboard...', icon: 'Rocket', iconColor: '#fb923c' },
    { text: 'Running Framerr.exe...', icon: 'Play', iconColor: '#34d399' },
    { text: 'Framerr.init()...', icon: 'Code', iconColor: '#818cf8' },
    { text: 'Loading world...', icon: 'Globe', iconColor: '#a78bfa' },
];

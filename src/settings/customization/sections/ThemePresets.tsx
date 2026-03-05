/**
 * Theme Presets Component
 * 
 * Grid of theme preset cards for quick theme selection.
 * Includes ripple animation on theme change for visual feedback.
 */

import React, { useState, useRef } from 'react';
import { Palette } from 'lucide-react';
import { SettingsSection } from '../../../shared/ui/settings';
import { useTheme } from '../../../context/ThemeContext';
import type { ThemeDefinition, CustomColors } from '../types';
import { themeColorPreviews, getCurrentThemeColors, removeColorsFromDOM } from '../utils/colorUtils';
import logger from '../../../utils/logger';

interface ThemePresetsProps {
    useCustomColors: boolean;
    customColorsEnabled: boolean;
    setUseCustomColors: (value: boolean) => void;
    setCustomColorsEnabled: (value: boolean) => void;
    setLastSelectedTheme: (themeId: string) => void;
    setCustomColors: (colors: CustomColors) => void;
    triggerRipple: (x: number, y: number, color: string) => void;
}

export function ThemePresets({
    useCustomColors,
    customColorsEnabled,
    setUseCustomColors,
    setCustomColorsEnabled,
    setLastSelectedTheme,
    setCustomColors,
    triggerRipple,
}: ThemePresetsProps) {
    const { theme, themes, changeTheme } = useTheme();

    // Optimistic UI: track selected theme locally for instant badge update
    const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
    const displayTheme = selectedTheme ?? theme; // Use local state if set, otherwise context

    // Debounce timer for backend save
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Throttle: track last ripple time to prevent rapid animation
    const lastRippleTimeRef = useRef<number>(0);
    const RIPPLE_THROTTLE_MS = 800; // Minimum time between ripples (match animation duration)

    const handleThemeSelect = async (themeId: string, event: React.MouseEvent<HTMLButtonElement>) => {
        if (customColorsEnabled || displayTheme !== themeId) {
            // Optimistic UI: Update badge immediately
            setSelectedTheme(themeId);
            setUseCustomColors(false);
            setCustomColorsEnabled(false);
            setLastSelectedTheme(themeId);

            // Get click position for ripple
            const rect = event.currentTarget.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

            // Get theme's background color for ripple
            const themeColors = themeColorPreviews[themeId];
            const rippleColor = themeColors?.bg || '#0a0e1a';

            // Throttled ripple: only trigger if enough time has passed
            const now = Date.now();
            if (now - lastRippleTimeRef.current >= RIPPLE_THROTTLE_MS) {
                lastRippleTimeRef.current = now;
                triggerRipple(x, y, rippleColor);
            }

            // Apply theme immediately: clear custom colors + switch theme (handles DOM, localStorage, API)
            removeColorsFromDOM();
            changeTheme(themeId).catch(error => {
                logger.error('[ThemePresets] Failed to save theme', { error });
            });

            // Debounced: sync color picker state after CSS transition settles
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
            saveTimerRef.current = setTimeout(() => {
                const newColors = getCurrentThemeColors();
                setCustomColors(newColors);
                setSelectedTheme(null);
            }, 1000);
        }
    };

    return (
        <SettingsSection title="Preset Themes" icon={Palette}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(themes as ThemeDefinition[]).map((t) => (
                    <button
                        key={t.id}
                        onClick={(e) => handleThemeSelect(t.id, e)}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${displayTheme === t.id && !useCustomColors
                            ? 'border-accent bg-accent/10'
                            : 'border-theme hover:border-theme-light bg-theme-tertiary hover:bg-theme-hover transition-all'
                            }`}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Palette
                                    size={20}
                                    className={displayTheme === t.id && !useCustomColors ? 'text-accent' : 'text-theme-secondary'}
                                />
                                <span className="font-semibold text-theme-primary">
                                    {t.name}
                                </span>
                            </div>
                            {displayTheme === t.id && !useCustomColors && (
                                <span className="text-xs px-2 py-1 rounded bg-accent text-white">
                                    Active
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-theme-secondary">
                            {t.description}
                        </p>
                        {/* Color Preview */}
                        <div className="flex gap-2 mt-3">
                            <div
                                className="w-8 h-8 rounded border border-theme"
                                style={{ backgroundColor: themeColorPreviews[t.id]?.bg || '#0a0e1a' }}
                            />
                            <div
                                className="w-8 h-8 rounded"
                                style={{ backgroundColor: themeColorPreviews[t.id]?.accent || '#3b82f6' }}
                            />
                            <div
                                className="w-8 h-8 rounded"
                                style={{ backgroundColor: themeColorPreviews[t.id]?.secondary || '#06b6d4' }}
                            />
                        </div>
                    </button>
                ))}
            </div>
        </SettingsSection>
    );
}


/**
 * Colors Section Component
 * 
 * Container for the Colors tab content (Theme Presets + Custom Colors Editor).
 * Includes ThemeRipple animation for visual feedback on theme changes.
 */

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SettingsPage } from '../../../shared/ui/settings';
import { ThemePresets } from './ThemePresets';
import { CustomColorsEditor } from './CustomColorsEditor';
import ThemeRipple from '../../../app/setup/ThemeRipple';
import type { CustomizationState } from '../types';

interface RippleState {
    active: boolean;
    x: number;
    y: number;
    color: string;
    key: number;
}

interface ColorsSectionProps {
    state: CustomizationState;
}

export function ColorsSection({ state }: ColorsSectionProps) {
    // Theme ripple animation state
    const [ripple, setRipple] = useState<RippleState>({
        active: false,
        x: 0,
        y: 0,
        color: '',
        key: 0
    });

    // Trigger theme ripple effect
    const triggerRipple = useCallback((x: number, y: number, color: string) => {
        // Increment key to force re-render even on rapid selections
        setRipple(prev => ({ active: true, x, y, color, key: prev.key + 1 }));

        // Clear ripple after animation (1000ms duration)
        setTimeout(() => {
            setRipple(prev => ({ ...prev, active: false }));
        }, 1000);
    }, []);

    return (
        <>
            {/* Theme ripple effect - rendered via portal for full-screen coverage */}
            {createPortal(
                <ThemeRipple
                    key={ripple.key}
                    active={ripple.active}
                    x={ripple.x}
                    y={ripple.y}
                    color={ripple.color}
                />,
                document.body
            )}

            <SettingsPage
                title="Colors"
                description="Choose a preset theme or create your own color scheme"
            >
                {/* Preset Themes Section */}
                <ThemePresets
                    useCustomColors={state.useCustomColors}
                    customColorsEnabled={state.customColorsEnabled}
                    setUseCustomColors={state.setUseCustomColors}
                    setCustomColorsEnabled={state.setCustomColorsEnabled}
                    setLastSelectedTheme={state.setLastSelectedTheme}
                    setCustomColors={state.setCustomColors}
                    triggerRipple={triggerRipple}
                />

                {/* Custom Colors Section */}
                <CustomColorsEditor
                    customColors={state.customColors}
                    customColorsEnabled={state.customColorsEnabled}
                    useCustomColors={state.useCustomColors}
                    autoSaving={state.autoSaving}
                    statusColorsExpanded={state.statusColorsExpanded}
                    setStatusColorsExpanded={state.setStatusColorsExpanded}
                    advancedExpanded={state.advancedExpanded}
                    setAdvancedExpanded={state.setAdvancedExpanded}
                    handleColorChange={state.handleColorChange}
                    handleToggleCustomColors={state.handleToggleCustomColors}
                />
            </SettingsPage>
        </>
    );
}


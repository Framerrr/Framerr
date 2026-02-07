import React, { useState, useEffect, useRef } from 'react';
import { Pipette } from 'lucide-react';

interface ColorPreset {
    name: string;
    value: string;
}

// Quick color presets for common theme colors
const COLOR_PRESETS: ColorPreset[] = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Purple', value: '#A855F7' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Yellow', value: '#EAB308' },
    { name: 'Green', value: '#10B981' },
    { name: 'Cyan', value: '#06B6D4' }
];

export interface ColorPickerProps {
    value?: string;
    onChange?: (color: string) => void;
    label?: string;
    description?: string;
    disabled?: boolean;
}

/**
 * ColorPicker - Premium color picker with glassmorphism design
 */
const ColorPicker = ({ value, onChange, label, disabled = false }: ColorPickerProps): React.JSX.Element => {
    const [color, setColor] = useState<string>(value || '#3B82F6');
    const colorInputRef = useRef<HTMLInputElement>(null);

    // Sync with parent value changes
    useEffect(() => {
        if (value) setColor(value);
    }, [value]);

    const handleColorChange = (newColor: string): void => {
        if (disabled) return;
        setColor(newColor);
        if (onChange) onChange(newColor);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        if (disabled) return;

        let newValue = e.target.value;

        // Auto-add # if missing
        if (newValue && !newValue.startsWith('#')) {
            newValue = '#' + newValue;
        }

        setColor(newValue);

        // Only call onChange if valid hex format
        if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
            if (onChange) onChange(newValue);
        }
    };

    // Trigger native color picker
    const openColorPicker = (): void => {
        colorInputRef.current?.click();
    };

    return (
        <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-theme-primary mb-2">
                    {label}
                </label>
            )}

            {/* Main Picker */}
            <div className="bg-theme-tertiary rounded-lg p-4 border border-theme space-y-4">
                {/* Color Display and Input Row */}
                <div className="flex items-center gap-3">
                    {/* Large Color Swatch - Clickable */}
                    <button
                        type="button"
                        onClick={openColorPicker}
                        className="relative w-14 h-14 rounded-xl border-2 border-theme shadow-lg flex-shrink-0 overflow-hidden group cursor-pointer transition-all hover:scale-105 hover:border-accent"
                        title="Click to open color picker"
                    >
                        {/* Color Fill */}
                        <div
                            className="absolute inset-0"
                            style={{ backgroundColor: color }}
                        />

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                            <Pipette
                                size={20}
                                className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
                            />
                        </div>
                    </button>

                    {/* Hex Input */}
                    <div className="flex-1">
                        <input
                            type="text"
                            value={color}
                            onChange={handleTextChange}
                            className="w-full bg-theme-secondary border border-theme rounded-lg px-4 py-3 text-theme-primary font-mono text-base focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                            placeholder="#3B82F6"
                            maxLength={7}
                        />
                    </div>

                    {/* Hidden Native Color Input */}
                    <input
                        ref={colorInputRef}
                        type="color"
                        value={color}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="w-0 h-0 opacity-0 absolute pointer-events-none"
                        tabIndex={-1}
                    />
                </div>

                {/* Quick Presets */}
                <div className="space-y-2">
                    <div className="text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                        Quick Presets
                    </div>
                    <div className="grid grid-cols-8 gap-2">
                        {COLOR_PRESETS.map(preset => (
                            <button
                                key={preset.value}
                                onClick={() => handleColorChange(preset.value)}
                                className="w-full aspect-square rounded-lg border-2 border-theme hover:border-accent hover:scale-110 transition-all shadow-medium hover:shadow-lg"
                                style={{ backgroundColor: preset.value }}
                                title={`${preset.name}: ${preset.value}`}
                                type="button"
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ColorPicker;

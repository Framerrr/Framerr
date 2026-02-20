/**
 * Custom Colors Editor Component
 * 
 * Color picker interface with tiered organization (Essentials, Status, Advanced).
 */

import React from 'react';
import { Paintbrush, ChevronDown } from 'lucide-react';
import ColorPicker from '../../../components/common/ColorPicker';
import { Switch } from '../../../shared/ui';
import { SettingsSection, SettingsItem } from '../../../shared/ui/settings';
import type { CustomColors } from '../types';

interface CustomColorsEditorProps {
    customColors: CustomColors;
    customColorsEnabled: boolean;
    useCustomColors: boolean;
    autoSaving: boolean;
    statusColorsExpanded: boolean;
    setStatusColorsExpanded: (expanded: boolean) => void;
    advancedExpanded: boolean;
    setAdvancedExpanded: (expanded: boolean) => void;
    handleColorChange: (key: string, value: string) => void;
    handleToggleCustomColors: (enabled: boolean) => Promise<void>;
}

export function CustomColorsEditor({
    customColors,
    customColorsEnabled,
    useCustomColors,
    autoSaving,
    statusColorsExpanded,
    setStatusColorsExpanded,
    advancedExpanded,
    setAdvancedExpanded,
    handleColorChange,
    handleToggleCustomColors,
}: CustomColorsEditorProps) {
    return (
        <SettingsSection
            title="Custom Colors"
            icon={Paintbrush}
            description="Create your own color scheme"
            headerRight={useCustomColors ? (
                <span className="text-xs px-3 py-1.5 rounded bg-accent text-white font-medium">
                    Custom Theme Active
                </span>
            ) : undefined}
        >

            {/* Enable Custom Colors Toggle */}
            <SettingsItem
                label="Enable Custom Colors"
                description={customColorsEnabled
                    ? 'Custom colors active - changes save automatically'
                    : 'Using theme colors - toggle to customize'}
                className="mb-6"
            >
                <Switch
                    checked={customColorsEnabled}
                    onCheckedChange={handleToggleCustomColors}
                />
            </SettingsItem>

            {/* Tier 1: Essentials (Always Visible) */}
            <div className="mb-8">
                <h4 className="text-sm font-bold text-theme-secondary uppercase tracking-wider mb-4">
                    Essentials
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Backgrounds Column */}
                    <div className="space-y-4">
                        <h5 className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Backgrounds</h5>
                        <ColorPicker
                            label="Primary Background"
                            value={customColors['bg-primary']}
                            onChange={(val: string) => handleColorChange('bg-primary', val)}
                            description="Main page background"
                            disabled={!customColorsEnabled}
                        />
                        <ColorPicker
                            label="Card Background"
                            value={customColors['bg-secondary']}
                            onChange={(val: string) => handleColorChange('bg-secondary', val)}
                            description="Cards and panels"
                            disabled={!customColorsEnabled}
                        />
                        <ColorPicker
                            label="Button Background"
                            value={customColors['bg-tertiary']}
                            onChange={(val: string) => handleColorChange('bg-tertiary', val)}
                            description="Buttons and inputs"
                            disabled={!customColorsEnabled}
                        />
                    </div>

                    {/* Accents Column */}
                    <div className="space-y-4">
                        <h5 className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Accents</h5>
                        <ColorPicker
                            label="Primary Accent"
                            value={customColors['accent']}
                            onChange={(val: string) => handleColorChange('accent', val)}
                            description="Buttons and highlights"
                            disabled={!customColorsEnabled}
                        />
                        <ColorPicker
                            label="Secondary Accent"
                            value={customColors['accent-secondary']}
                            onChange={(val: string) => handleColorChange('accent-secondary', val)}
                            description="Links and secondary actions"
                            disabled={!customColorsEnabled}
                        />
                    </div>

                    {/* Text Column */}
                    <div className="space-y-4">
                        <h5 className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Text</h5>
                        <ColorPicker
                            label="Primary Text"
                            value={customColors['text-primary']}
                            onChange={(val: string) => handleColorChange('text-primary', val)}
                            description="Main text color"
                            disabled={!customColorsEnabled}
                        />
                        <ColorPicker
                            label="Secondary Text"
                            value={customColors['text-secondary']}
                            onChange={(val: string) => handleColorChange('text-secondary', val)}
                            description="Labels and descriptions"
                            disabled={!customColorsEnabled}
                        />
                        <ColorPicker
                            label="Muted Text"
                            value={customColors['text-tertiary']}
                            onChange={(val: string) => handleColorChange('text-tertiary', val)}
                            description="Hints and timestamps"
                            disabled={!customColorsEnabled}
                        />
                    </div>

                    {/* Borders Column */}
                    <div className="space-y-4">
                        <h5 className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Borders</h5>
                        <ColorPicker
                            label="Primary Border"
                            value={customColors['border']}
                            onChange={(val: string) => handleColorChange('border', val)}
                            description="Dividers and outlines"
                            disabled={!customColorsEnabled}
                        />
                        <ColorPicker
                            label="Light Border"
                            value={customColors['border-light']}
                            onChange={(val: string) => handleColorChange('border-light', val)}
                            description="Subtle separators"
                            disabled={!customColorsEnabled}
                        />
                    </div>
                </div>
            </div>

            {/* Tier 2: Status Colors (Collapsible) */}
            <div className="mb-8">
                <button
                    onClick={() => setStatusColorsExpanded(!statusColorsExpanded)}
                    className="w-full flex items-center justify-between p-4 bg-theme-tertiary hover:bg-theme-hover rounded-xl border border-theme transition-all mb-4"
                >
                    <div className="flex items-center gap-3">
                        <h4 className="text-sm font-bold text-theme-secondary uppercase tracking-wider">
                            Status Colors
                        </h4>
                        <span className="text-xs text-theme-tertiary">(4 colors)</span>
                    </div>
                    <ChevronDown
                        size={18}
                        className={`text-theme-tertiary transition-transform ${statusColorsExpanded ? 'rotate-180' : ''}`}
                    />
                </button>
                {statusColorsExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pl-4">
                        <ColorPicker
                            label="Success"
                            value={customColors['success']}
                            onChange={(val: string) => handleColorChange('success', val)}
                            description="Completed actions"
                            disabled={!customColorsEnabled}
                        />
                        <ColorPicker
                            label="Warning"
                            value={customColors['warning']}
                            onChange={(val: string) => handleColorChange('warning', val)}
                            description="Cautions"
                            disabled={!customColorsEnabled}
                        />
                        <ColorPicker
                            label="Error"
                            value={customColors['error']}
                            onChange={(val: string) => handleColorChange('error', val)}
                            description="Errors"
                            disabled={!customColorsEnabled}
                        />
                        <ColorPicker
                            label="Info"
                            value={customColors['info']}
                            onChange={(val: string) => handleColorChange('info', val)}
                            description="Information"
                            disabled={!customColorsEnabled}
                        />
                    </div>
                )}
            </div>

            {/* Tier 3: Advanced (Collapsible) */}
            <div className="mb-8">
                <button
                    onClick={() => setAdvancedExpanded(!advancedExpanded)}
                    className="w-full flex items-center justify-between p-4 bg-theme-tertiary hover:bg-theme-hover rounded-xl border border-theme transition-all mb-4"
                >
                    <div className="flex items-center gap-3">
                        <h4 className="text-sm font-bold text-theme-secondary uppercase tracking-wider">
                            Advanced
                        </h4>
                        <span className="text-xs text-theme-tertiary">(7 colors)</span>
                    </div>
                    <ChevronDown
                        size={18}
                        className={`text-theme-tertiary transition-transform ${advancedExpanded ? 'rotate-180' : ''}`}
                    />
                </button>
                {advancedExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-4">
                        {/* Interactive States */}
                        <div className="space-y-4">
                            <h5 className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Interactive States</h5>
                            <ColorPicker
                                label="Hover Background"
                                value={customColors['bg-hover']}
                                onChange={(val: string) => handleColorChange('bg-hover', val)}
                                description="Background on hover"
                                disabled={!customColorsEnabled}
                            />
                            <ColorPicker
                                label="Accent Hover"
                                value={customColors['accent-hover']}
                                onChange={(val: string) => handleColorChange('accent-hover', val)}
                                description="Accent color on hover"
                                disabled={!customColorsEnabled}
                            />
                            <ColorPicker
                                label="Light Accent"
                                value={customColors['accent-light']}
                                onChange={(val: string) => handleColorChange('accent-light', val)}
                                description="Light accent variant"
                                disabled={!customColorsEnabled}
                            />
                        </div>

                        {/* Special Borders */}
                        <div className="space-y-4">
                            <h5 className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider">Special Borders</h5>
                            <ColorPicker
                                label="Accent Border"
                                value={customColors['border-accent']}
                                onChange={(val: string) => handleColorChange('border-accent', val)}
                                description="Highlighted borders"
                                disabled={!customColorsEnabled}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Auto-save Indicator */}
            {autoSaving && (
                <div className="text-xs text-theme-tertiary flex items-center gap-2 mt-3">
                    <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                </div>
            )}
        </SettingsSection>
    );
}

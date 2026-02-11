/**
 * Greeting Section — Settings UI for dashboard header customization
 *
 * Controls:
 * 1. Header Visibility toggle — show/hide entire header area
 * 2. Greeting Mode — Auto (time-based) vs Custom (manual text)
 * 3. Tone chips — filter which greeting styles appear (Auto mode only)
 * 4. Tagline — show/hide + custom text for the subtitle
 * 5. Loading messages toggle — show fun loading text during dashboard load
 */

import { ChangeEvent } from 'react';
import { MessageSquare, Wand2, Type, Save, RotateCcw } from 'lucide-react';
import { SettingsSection, SettingsItem } from '../../../shared/ui/settings';
import { Input } from '../../../components/common/Input';
import { Switch, Button } from '../../../shared/ui';

const TONE_OPTIONS = [
    { id: 'standard', label: 'Standard', description: 'Time of day, greetings' },
    { id: 'witty', label: 'Witty', description: 'Playful, personality' },
    { id: 'nerdy', label: 'Nerdy', description: 'Coding, pop culture' },
] as const;

interface GreetingSectionProps {
    // Header visibility
    headerVisible: boolean;
    setHeaderVisible: (visible: boolean) => void;

    // Greeting mode
    greetingMode: 'auto' | 'manual';
    setGreetingMode: (mode: 'auto' | 'manual') => void;
    greetingText: string;
    setGreetingText: (text: string) => void;

    // Tones
    tones: string[];
    setTones: (tones: string[]) => void;

    // Loading messages
    loadingMessagesEnabled: boolean;
    setLoadingMessagesEnabled: (enabled: boolean) => void;

    // Tagline
    taglineEnabled: boolean;
    setTaglineEnabled: (enabled: boolean) => void;
    taglineText: string;
    setTaglineText: (text: string) => void;

    // Actions
    savingGreeting: boolean;
    hasGreetingChanges: boolean;
    handleSaveGreeting: () => void;
    handleResetGreeting: () => void;
}

export function GreetingSection({
    headerVisible,
    setHeaderVisible,
    greetingMode,
    setGreetingMode,
    greetingText,
    setGreetingText,
    tones,
    setTones,
    loadingMessagesEnabled,
    setLoadingMessagesEnabled,
    taglineEnabled,
    setTaglineEnabled,
    taglineText,
    setTaglineText,
    savingGreeting,
    hasGreetingChanges,
    handleSaveGreeting,
    handleResetGreeting,
}: GreetingSectionProps) {

    const handleToneToggle = (toneId: string) => {
        const isActive = tones.includes(toneId);
        if (isActive && tones.length <= 1) return; // Enforce at least one
        if (isActive) {
            setTones(tones.filter(t => t !== toneId));
        } else {
            setTones([...tones, toneId]);
        }
    };

    return (
        <SettingsSection
            title="Dashboard Greeting"
            icon={MessageSquare}
            description="Customize the header area displayed on your dashboard."
        >
            {/* Header Visibility Toggle */}
            <SettingsItem
                label="Show Dashboard Header"
                description="Display the greeting and tagline on your dashboard"
            >
                <Switch
                    checked={headerVisible}
                    onCheckedChange={setHeaderVisible}
                />
            </SettingsItem>

            {/* Greeting Mode Selector */}
            <div className={`space-y-3 ${!headerVisible ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-theme-primary">Greeting Style</label>
                    <p className="text-xs text-theme-tertiary">Choose how your greeting is generated</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setGreetingMode('auto')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${greetingMode === 'auto'
                            ? 'bg-accent/20 text-accent border border-accent/30'
                            : 'bg-theme-tertiary text-theme-secondary border border-transparent hover:bg-theme-hover'
                            }`}
                    >
                        <Wand2 size={14} />
                        Auto
                    </button>
                    <button
                        onClick={() => setGreetingMode('manual')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${greetingMode === 'manual'
                            ? 'bg-accent/20 text-accent border border-accent/30'
                            : 'bg-theme-tertiary text-theme-secondary border border-transparent hover:bg-theme-hover'
                            }`}
                    >
                        <Type size={14} />
                        Custom
                    </button>
                </div>

                {/* Auto mode: Tone filter chips */}
                {greetingMode === 'auto' && (
                    <div className="space-y-2">
                        <p className="text-xs text-theme-tertiary">
                            Select which greeting styles to include:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {TONE_OPTIONS.map(tone => {
                                const isActive = tones.includes(tone.id);
                                const isOnly = isActive && tones.length <= 1;
                                return (
                                    <button
                                        key={tone.id}
                                        onClick={() => handleToneToggle(tone.id)}
                                        disabled={isOnly}
                                        title={isOnly ? 'At least one style must be selected' : tone.description}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${isActive
                                            ? 'bg-accent/20 text-accent border border-accent/30'
                                            : 'bg-theme-tertiary text-theme-tertiary border border-transparent hover:bg-theme-hover hover:text-theme-secondary'
                                            } ${isOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                        {tone.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {greetingMode === 'manual' && (
                    <Input
                        label="Custom Greeting"
                        value={greetingText}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setGreetingText(e.target.value)}
                        maxLength={100}
                        placeholder="Welcome back, adventurer"
                        helperText={`${greetingText.length}/100 characters`}
                    />
                )}
            </div>

            {/* Tagline Controls */}
            <div className={`space-y-3 ${!headerVisible ? 'opacity-50 pointer-events-none' : ''}`}>
                <SettingsItem
                    label="Show Tagline"
                    description="Display a subtitle below your greeting"
                >
                    <Switch
                        checked={taglineEnabled}
                        onCheckedChange={setTaglineEnabled}
                    />
                </SettingsItem>

                {taglineEnabled && (
                    <Input
                        label="Tagline Text"
                        value={taglineText}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setTaglineText(e.target.value)}
                        maxLength={100}
                        placeholder="Your personal dashboard"
                        helperText={`${taglineText.length}/100 characters`}
                    />
                )}
            </div>

            {/* Loading Messages Toggle */}
            <SettingsItem
                label="Loading Messages"
                description="Show fun messages while the dashboard loads"
            >
                <Switch
                    checked={loadingMessagesEnabled}
                    onCheckedChange={setLoadingMessagesEnabled}
                />
            </SettingsItem>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    onClick={handleSaveGreeting}
                    disabled={!hasGreetingChanges || savingGreeting}
                    icon={Save}
                    size="md"
                    textSize="sm"
                >
                    {savingGreeting ? 'Saving...' : 'Save'}
                </Button>
                <Button
                    onClick={handleResetGreeting}
                    variant="secondary"
                    icon={RotateCcw}
                    title="Reset to defaults"
                    size="md"
                    textSize="sm"
                >
                    <span className="hidden sm:inline">Reset</span>
                </Button>
            </div>
        </SettingsSection>
    );
}

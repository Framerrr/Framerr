/**
 * Greeting Section Component
 * 
 * Dashboard greeting configuration with enable toggle and custom text.
 */

import React, { ChangeEvent } from 'react';
import { MessageSquare, Save, RotateCcw } from 'lucide-react';
import { Input } from '../../../components/common/Input';
import { Button, Switch } from '../../../shared/ui';
import { SettingsSection, SettingsItem } from '../../../shared/ui/settings';

interface GreetingSectionProps {
    greetingEnabled: boolean;
    setGreetingEnabled: (enabled: boolean) => void;
    greetingText: string;
    setGreetingText: (text: string) => void;
    savingGreeting: boolean;
    hasGreetingChanges: boolean;
    handleSaveGreeting: () => Promise<void>;
    handleResetGreeting: () => void;
}

export function GreetingSection({
    greetingEnabled,
    setGreetingEnabled,
    greetingText,
    setGreetingText,
    savingGreeting,
    hasGreetingChanges,
    handleSaveGreeting,
    handleResetGreeting,
}: GreetingSectionProps) {
    return (
        <SettingsSection
            title="Dashboard Greeting"
            icon={MessageSquare}
            description="Customize the welcome message displayed on your dashboard."
        >
            {/* Enable/Disable Toggle */}
            <SettingsItem
                label="Show Welcome Message"
                description="Display a custom greeting under your dashboard header"
            >
                <Switch
                    checked={greetingEnabled}
                    onCheckedChange={setGreetingEnabled}
                />
            </SettingsItem>

            {/* Greeting Text Input */}
            <Input
                label="Custom Greeting Text"
                value={greetingText}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setGreetingText(e.target.value)}
                disabled={!greetingEnabled}
                maxLength={100}
                placeholder="Your personal dashboard"
                helperText={`${greetingText.length}/100 characters`}
            />

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    onClick={handleSaveGreeting}
                    disabled={!hasGreetingChanges || savingGreeting}
                    icon={Save}
                    size="md"
                    textSize="sm"
                >
                    {savingGreeting ? 'Saving...' : 'Save Greeting'}
                </Button>
                <Button
                    onClick={handleResetGreeting}
                    variant="secondary"
                    icon={RotateCcw}
                    title="Reset to default"
                    size="md"
                    textSize="sm"
                >
                    <span className="hidden sm:inline">Reset</span>
                </Button>
            </div>
        </SettingsSection>
    );
}


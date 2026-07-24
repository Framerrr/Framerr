import React, { useState } from 'react';
import { Pause, Shield, ShieldOff } from 'lucide-react';
import { Button, Input, Popover } from '../../../shared/ui';

interface ProtectionToggleProps {
    protectionEnabled: boolean;
    togglingProtection: boolean;
    onToggle: (enabled: boolean, duration?: number) => Promise<void>;
}

const PAUSE_PRESETS = [
    { label: '5m', seconds: 5 * 60 },
    { label: '15m', seconds: 15 * 60 },
    { label: '1h', seconds: 60 * 60 },
    { label: '3h', seconds: 3 * 60 * 60 },
    { label: '24h', seconds: 24 * 60 * 60 },
];

const ProtectionToggle: React.FC<ProtectionToggleProps> = ({
    protectionEnabled,
    togglingProtection,
    onToggle,
}) => {
    const [pauseOpen, setPauseOpen] = useState(false);
    const [customMinutes, setCustomMinutes] = useState('15');

    const handlePause = async (seconds: number) => {
        setPauseOpen(false);
        await onToggle(false, seconds);
    };

    const handleCustomPause = async () => {
        const minutes = parseInt(customMinutes, 10);
        if (!Number.isFinite(minutes) || minutes <= 0) return;
        await handlePause(minutes * 60);
    };

    return (
        <div className="dns-stats-controls">
            {protectionEnabled ? (
                <>
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={ShieldOff}
                        loading={togglingProtection}
                        disabled={togglingProtection}
                        onClick={() => onToggle(false)}
                    >
                        Disable
                    </Button>

                    <Popover open={pauseOpen} onOpenChange={setPauseOpen}>
                        <Popover.Trigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                icon={Pause}
                                loading={togglingProtection}
                                disabled={togglingProtection}
                            >
                                Pause
                            </Button>
                        </Popover.Trigger>
                        <Popover.Content side="bottom" align="start" sideOffset={4}>
                            <div className="dns-stats-pause-popover">
                                <p className="dns-stats-pause-title text-theme-primary">Pause protection</p>
                                <div className="dns-stats-pause-presets">
                                    {PAUSE_PRESETS.map((preset) => (
                                        <Button
                                            key={preset.label}
                                            variant="secondary"
                                            size="sm"
                                            disabled={togglingProtection}
                                            onClick={() => handlePause(preset.seconds)}
                                        >
                                            {preset.label}
                                        </Button>
                                    ))}
                                </div>
                                <div className="dns-stats-pause-custom">
                                    <Input
                                        type="number"
                                        size="sm"
                                        min={1}
                                        step={1}
                                        inputMode="numeric"
                                        value={customMinutes}
                                        onChange={(e) => {
                                            const next = e.target.value.replace(/[^\d]/g, '');
                                            setCustomMinutes(next);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                void handleCustomPause();
                                            }
                                        }}
                                        className="dns-stats-pause-input mb-0"
                                        aria-label="Custom pause duration in minutes"
                                    />
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        disabled={togglingProtection}
                                        onClick={handleCustomPause}
                                    >
                                        Apply
                                    </Button>
                                </div>
                            </div>
                        </Popover.Content>
                    </Popover>
                </>
            ) : (
                <Button
                    variant="primary"
                    size="sm"
                    icon={Shield}
                    loading={togglingProtection}
                    disabled={togglingProtection}
                    onClick={() => onToggle(true)}
                >
                    Enable Protection
                </Button>
            )}
        </div>
    );
};

export default ProtectionToggle;

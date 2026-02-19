/**
 * WalkthroughCard
 * 
 * The popover card shown during walkthrough steps.
 * Matches the design language of Popover.Content.
 * 
 * Contains: title, message, action hint (for event-driven steps),
 * step dots, and buttons.
 */

import React from 'react';
import { Button } from '../../shared/ui/Button';
import type { WalkthroughStep } from './types';

interface WalkthroughCardProps {
    step: WalkthroughStep;
    stepNumber: number;
    totalSteps: number;
    onNext: () => void;
    onSkip: () => void;
    /** Whether this is the first step (shows "Start Tour" instead of "Next") */
    isFirst: boolean;
    /** Whether this is the last step (shows "Finish" instead of "Next") */
    isLast: boolean;
}

const WalkthroughCard: React.FC<WalkthroughCardProps> = ({
    step,
    stepNumber,
    totalSteps,
    onNext,
    onSkip,
    isFirst,
    isLast,
}) => {
    const showNextButton = step.advanceOn.type === 'button';
    const isActionStep = step.advanceOn.type === 'action';

    return (
        <div className="walkthrough-card">
            {/* Title */}
            <h3 className="walkthrough-card-title">{step.title}</h3>

            {/* Message */}
            <p className="walkthrough-card-message">{step.message}</p>

            {/* Hint for action-driven steps */}
            {isActionStep && (
                <div className="walkthrough-action-hint">
                    ↑ Try it now
                </div>
            )}

            {/* Footer: Step dots + Buttons */}
            <div className="walkthrough-card-footer" style={isActionStep ? { marginTop: 16 } : undefined}>
                {/* Step indicator dots */}
                <div className="walkthrough-dots">
                    {Array.from({ length: totalSteps }, (_, i) => (
                        <span
                            key={i}
                            className={`walkthrough-dot ${i + 1 === stepNumber ? 'active' : ''} ${i + 1 < stepNumber ? 'completed' : ''}`}
                        />
                    ))}
                </div>

                {/* Buttons */}
                <div className="walkthrough-card-buttons">
                    {!isLast && (
                        <Button variant="outline" size="sm" onClick={onSkip}>
                            Skip
                        </Button>
                    )}
                    {showNextButton && (
                        <Button variant="primary" size="sm" onClick={onNext}>
                            {isFirst ? 'Start Tour' : isLast ? 'Finish' : 'Next'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WalkthroughCard;

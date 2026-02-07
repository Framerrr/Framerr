/**
 * PartialErrorBadge - Shows alert icon when some (but not all) instances are errored
 * 
 * Used in multi-integration widgets (Calendar, etc.) to indicate partial failures
 * without blocking the entire widget content.
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Popover } from '../../ui';
import { usePopoverState } from '../../../hooks/usePopoverState';

export interface ErroredInstance {
    id: string;
    name: string;
}

export interface PartialErrorBadgeProps {
    /** List of instances that have errors */
    erroredInstances: ErroredInstance[];
    /** Optional custom class for positioning */
    className?: string;
}

/**
 * Format error message with proper grammar
 * 1 instance: "Server1 is unreachable"
 * 2 instances: "Server1 and Server2 are unreachable"
 * 3+ instances: "Server1, Server2, and N others are unreachable"
 */
function formatErrorMessage(instances: ErroredInstance[]): string {
    if (instances.length === 0) return '';
    if (instances.length === 1) {
        return `${instances[0].name} is unreachable`;
    }
    if (instances.length === 2) {
        return `${instances[0].name} and ${instances[1].name} are unreachable`;
    }
    // 3+ instances
    const othersCount = instances.length - 2;
    return `${instances[0].name}, ${instances[1].name}, and ${othersCount} other${othersCount > 1 ? 's' : ''} are unreachable`;
}

export const PartialErrorBadge: React.FC<PartialErrorBadgeProps> = ({
    erroredInstances,
    className = '',
}) => {
    const { isOpen, onOpenChange } = usePopoverState();

    // Don't render if no errors
    if (erroredInstances.length === 0) {
        return null;
    }

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <Popover.Trigger asChild>
                <button
                    className={`
                        flex items-center justify-center
                        w-6 h-6 rounded-full
                        bg-error/20 text-error
                        hover:bg-error/30 transition-colors
                        cursor-pointer
                        ${className}
                    `}
                    title="Some integrations are unavailable"
                >
                    <AlertCircle className="w-4 h-4" />
                </button>
            </Popover.Trigger>

            <Popover.Content
                side="bottom"
                align="end"
                sideOffset={4}
                className="min-w-[160px] max-w-[240px]"
            >
                <div className="text-xs text-theme-secondary font-medium mb-2">
                    Connection Issues
                </div>
                <div className="text-sm text-theme-primary">
                    {formatErrorMessage(erroredInstances)}
                </div>
                <div className="mt-2 space-y-1">
                    {erroredInstances.map(instance => (
                        <div
                            key={instance.id}
                            className="flex items-center gap-2 text-xs text-theme-secondary"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-error" />
                            <span>{instance.name}</span>
                        </div>
                    ))}
                </div>
            </Popover.Content>
        </Popover>
    );
};

export default PartialErrorBadge;

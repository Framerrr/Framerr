/**
 * PartialErrorBadge - Shows alert icon when some (but not all) instances are errored
 * 
 * Used in multi-integration widgets (Calendar, etc.) to indicate partial failures
 * without blocking the entire widget content.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button, Popover } from '../../ui';
import { usePopoverState } from '@/shared/hooks/usePopoverState';

/** Keep Retry All in loading state through server burst (5 polls × 5s). */
const RETRY_PENDING_MS = 20_000;

export interface ErroredInstance {
    id: string;
    name: string;
}

export interface PartialErrorBadgeProps {
    /** List of instances that have errors */
    erroredInstances: ErroredInstance[];
    /** Optional custom class for positioning */
    className?: string;
    /** Optional retry handler. When provided, a "Retry All" button is shown in the popover. */
    onRetry?: () => Promise<void> | void;
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
    onRetry,
}) => {
    const { isOpen, onOpenChange } = usePopoverState();
    const [retrying, setRetrying] = useState(false);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []);

    const handleRetryClick = async (): Promise<void> => {
        if (!onRetry || retrying) return;
        setRetrying(true);
        try {
            await onRetry();
        } finally {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
            retryTimeoutRef.current = setTimeout(() => {
                setRetrying(false);
                retryTimeoutRef.current = null;
            }, RETRY_PENDING_MS);
        }
    };

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
                {onRetry && (
                    <div className="mt-3 pt-2 border-t border-theme">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={RotateCcw}
                            loading={retrying}
                            onClick={() => { void handleRetryClick(); }}
                            className="w-full"
                        >
                            {retrying ? 'Retrying…' : 'Retry All'}
                        </Button>
                    </div>
                )}
            </Popover.Content>
        </Popover>
    );
};

export default PartialErrorBadge;

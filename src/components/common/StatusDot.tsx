/**
 * StatusDot Component
 * 
 * A reusable status indicator dot with pulse animation for different states.
 * Used by ServiceStatusWidget and potentially other monitoring components.
 */

import React from 'react';
import { Pause } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type MonitorStatus = 'up' | 'down' | 'degraded' | 'maintenance' | 'pending';

export interface StatusDotProps {
    status: MonitorStatus;
    size?: 'sm' | 'md';
}

// ============================================================================
// Component
// ============================================================================

const StatusDot: React.FC<StatusDotProps> = ({ status, size = 'md' }) => {
    const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
    const iconSize = size === 'sm' ? 10 : 12;

    const getStatusColor = () => {
        switch (status) {
            case 'up': return 'bg-success';
            case 'down': return 'bg-error';
            case 'degraded': return 'bg-warning';
            case 'maintenance': return 'bg-theme-tertiary';
            default: return 'bg-theme-tertiary';
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'maintenance':
                return <Pause size={iconSize} className="text-theme-tertiary" />;
            default:
                return <div className={`${sizeClass} rounded-full ${getStatusColor()}`} />;
        }
    };

    return getStatusIcon();
};

export default StatusDot;

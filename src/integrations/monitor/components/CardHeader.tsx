/**
 * CardHeader - Collapsed header view for MonitorCard
 * Shows status dot, icon, name, response time, share badge, and expand chevron
 */

import React from 'react';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import IconPicker from '../../../components/IconPicker';
import { CardHeaderProps, MonitorStatus } from '../types';

// Get status dot color based on monitor status
const getStatusColor = (status?: MonitorStatus): string => {
    switch (status) {
        case 'up': return 'bg-success';
        case 'down': return 'bg-error';
        case 'degraded': return 'bg-warning';
        case 'maintenance': return 'bg-theme-tertiary';
        case 'pending':
        default: return 'bg-theme-tertiary';
    }
};

// Format response time for display
const formatResponseTime = (ms?: number, status?: MonitorStatus): string => {
    if (status === 'maintenance') return 'Maintenance';
    if (status === 'down') return 'Offline';
    if (ms === undefined || ms === null) return 'Pending';
    return `${ms}ms`;
};

const CardHeader: React.FC<CardHeaderProps> = ({
    monitor,
    isNew,
    isExpanded,
    onToggleExpand,
    onIconChange
}) => {
    return (
        <div
            onClick={onToggleExpand}
            className="w-full flex items-center gap-3 p-3 hover:bg-theme-hover transition-colors text-left cursor-pointer"
        >
            {/* Status dot */}
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusColor(monitor.status)}`} />

            {/* Icon - clickable picker for all monitors */}
            <div onClick={(e) => e.stopPropagation()}>
                <IconPicker
                    value={monitor.icon}
                    onChange={onIconChange}
                    compact
                />
            </div>

            {/* Name */}
            <span className="flex-1 font-medium text-theme-primary truncate">
                {monitor.name || (isNew ? 'New Monitor' : 'Unnamed')}
            </span>

            {/* Response time */}
            <span className={`text-sm flex-shrink-0 ${monitor.status === 'up' ? 'text-success' :
                monitor.status === 'degraded' ? 'text-warning' :
                    monitor.status === 'down' ? 'text-error' :
                        'text-theme-tertiary'
                }`}>
                {formatResponseTime(monitor.response_time_ms, monitor.status)}
            </span>

            {/* Share count badge */}
            {monitor.share_count && monitor.share_count > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-theme-tertiary text-theme-secondary text-xs">
                    <Users size={12} />
                    {monitor.share_count}
                </div>
            )}

            {/* Expand chevron */}
            {isExpanded ? (
                <ChevronUp size={20} className="text-theme-tertiary flex-shrink-0" />
            ) : (
                <ChevronDown size={20} className="text-theme-tertiary flex-shrink-0" />
            )}
        </div>
    );
};

export default CardHeader;

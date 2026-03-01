/**
 * DiskMetricCard — Renders disk metrics for the System Status widget.
 *
 * Handles all 4 display combinations:
 * - Individual + Expanded view (per-disk stacked card)
 * - Individual + Inline view  (per-disk horizontal card)
 * - Collapsed + Expanded view (aggregate card with click-to-expand popover)
 * - Collapsed + Inline view   (aggregate inline card with popover)
 *
 * Reuses the same metric-card CSS patterns as other System Status cards.
 * Uses StatusDot for per-disk health, Popover for collapsed expansion.
 */

import React, { useState, useRef, useEffect } from 'react';
import { HardDrive, AlertCircle, ChevronDown } from 'lucide-react';
import StatusDot, { type MonitorStatus } from '../../../components/common/StatusDot';
import { Popover } from '../../../shared/ui';
import type { DiskInfo } from '../types';

// ============================================================================
// HELPERS
// ============================================================================

/** Map DiskInfo status to StatusDot MonitorStatus */
function toMonitorStatus(status: DiskInfo['status']): MonitorStatus {
    switch (status) {
        case 'ok': return 'up';
        case 'disabled':
        case 'new': return 'degraded';
        case 'invalid':
        case 'wrong':
        case 'missing': return 'down';
        case 'not-present': return 'maintenance';
        default: return 'pending';
    }
}

/** Format bytes to human-readable TB/GB */
function formatBytes(bytes: number): string {
    if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
    return `${bytes} B`;
}

/** Get color for usage percentage */
function getUsageColor(percent: number): string {
    if (percent < 50) return 'var(--success)';
    if (percent < 80) return 'var(--warning)';
    return 'var(--error)';
}

/** Build bar hover tooltip text */
function buildTooltip(disk: DiskInfo, includeTemp: boolean): string {
    const parts: string[] = [];
    if (disk.fsSize !== null && disk.fsFree !== null) {
        const used = disk.fsSize - disk.fsFree;
        parts.push(`${formatBytes(used)} / ${formatBytes(disk.fsSize)}`);
    }
    if (includeTemp && disk.temp !== null) {
        parts.push(`${disk.temp}°C`);
    }
    return parts.join(' · ') || '';
}

/** Build aggregate tooltip text */
function buildAggregateTooltip(disks: DiskInfo[], includeTemp: boolean): string {
    let totalSize = 0;
    let totalUsed = 0;
    let maxTemp: number | null = null;

    for (const d of disks) {
        if (d.fsSize !== null && d.fsFree !== null) {
            totalSize += d.fsSize;
            totalUsed += d.fsSize - d.fsFree;
        }
        if (d.temp !== null && (maxTemp === null || d.temp > maxTemp)) {
            maxTemp = d.temp;
        }
    }

    const parts: string[] = [];
    if (totalSize > 0) {
        parts.push(`${formatBytes(totalUsed)} / ${formatBytes(totalSize)}`);
    }
    if (includeTemp && maxTemp !== null) {
        parts.push(`${maxTemp}°C`);
    }
    return parts.join(' · ') || '';
}

/** Get aggregate usage percentage across disks */
function getAggregateUsage(disks: DiskInfo[]): number {
    let totalSize = 0;
    let totalUsed = 0;
    for (const d of disks) {
        if (d.fsSize !== null && d.fsFree !== null) {
            totalSize += d.fsSize;
            totalUsed += d.fsSize - d.fsFree;
        }
    }
    return totalSize > 0 ? Math.round((totalUsed / totalSize) * 100) : 0;
}

/** Get max temperature across disks */
function getMaxTemp(disks: DiskInfo[]): number | null {
    let max: number | null = null;
    for (const d of disks) {
        if (d.temp !== null && (max === null || d.temp > max)) {
            max = d.temp;
        }
    }
    return max;
}

// ============================================================================
// SINGLE DISK ROW — reused in individual cards and popover list
// ============================================================================

interface DiskRowProps {
    disk: DiskInfo;
    isInline: boolean;
}

const DiskRow: React.FC<DiskRowProps> = ({ disk, isInline }) => {
    const usage = disk.usagePercent ?? 0;
    const tooltip = buildTooltip(disk, isInline); // inline: temp in tooltip
    const usedBytes = disk.fsSize !== null && disk.fsFree !== null ? disk.fsSize - disk.fsFree : null;
    const freeBytes = disk.fsFree;

    return (
        <div className="metric-card__inner">
            <div className="metric-card__header">
                <span className="metric-card__label">
                    <HardDrive size={14} />
                    {disk.name}
                    <StatusDot status={toMonitorStatus(disk.status)} size="sm" />
                    {/* Temp shown in expanded (non-inline) view only */}
                    {!isInline && disk.temp !== null && (
                        <span className="metric-card__disk-temp">
                            {disk.temp}°C
                        </span>
                    )}
                </span>
                <span className="metric-card__value">
                    {disk.usagePercent !== null ? `${disk.usagePercent}%` : '--'}
                </span>
            </div>
            {disk.usagePercent !== null && (
                <div className="metric-card__progress metric-card__progress--labeled" title={tooltip}>
                    <div
                        className="metric-card__progress-fill"
                        style={{
                            width: `${usage}%`,
                            backgroundColor: getUsageColor(usage),
                        }}
                    >
                        {usedBytes !== null && (
                            <span className="metric-card__bar-label metric-card__bar-label--used">{formatBytes(usedBytes)}</span>
                        )}
                    </div>
                    {freeBytes !== null && freeBytes > 0 && (
                        <span className="metric-card__bar-label metric-card__bar-label--free">{formatBytes(freeBytes)}</span>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// WARNING INDICATOR — shown on aggregate card when disks have issues
// ============================================================================

interface DiskWarningIndicatorProps {
    unhealthyDisks: DiskInfo[];
}

const DiskWarningIndicator: React.FC<DiskWarningIndicatorProps> = ({ unhealthyDisks }) => {
    if (unhealthyDisks.length === 0) return null;

    return (
        <Popover>
            <Popover.Trigger asChild>
                <button
                    className="disk-warning-trigger"
                    aria-label={`${unhealthyDisks.length} disk${unhealthyDisks.length > 1 ? 's' : ''} with issues`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <AlertCircle size={14} />
                </button>
            </Popover.Trigger>
            <Popover.Content
                side="bottom"
                align="start"
                sideOffset={4}
                className="disk-warning-popover"
            >
                <div className="disk-warning-popover__title">
                    Disk Issues ({unhealthyDisks.length})
                </div>
                <div className="disk-warning-popover__list">
                    {unhealthyDisks.map((d) => (
                        <div key={d.id} className="disk-warning-popover__item">
                            <StatusDot status={toMonitorStatus(d.status)} size="sm" />
                            <span>{d.name}</span>
                            <span className="disk-warning-popover__status">{d.status}</span>
                        </div>
                    ))}
                </div>
            </Popover.Content>
        </Popover>
    );
};

// ============================================================================
// DISK METRIC CARD — main export
// ============================================================================

export interface DiskMetricCardProps {
    /** Single disk data (individual mode) */
    disk?: DiskInfo;
    /** All selected disks (collapsed/aggregate mode) */
    disks?: DiskInfo[];
    /** Whether this is a collapsed aggregate card */
    isAggregate: boolean;
    /** Whether the widget is in inline (compact) CSS mode */
    isInline: boolean;
    /** Span class for grid positioning */
    spanClass: string;
}

const DiskMetricCard: React.FC<DiskMetricCardProps> = ({
    disk,
    disks = [],
    isAggregate,
    isInline,
    spanClass,
}) => {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [triggerWidth, setTriggerWidth] = useState<number | undefined>(undefined);

    // Measure trigger width for popover sizing
    useEffect(() => {
        if (popoverOpen && triggerRef.current) {
            setTriggerWidth(triggerRef.current.offsetWidth);
        }
    }, [popoverOpen]);

    // ── Individual disk card ──
    if (!isAggregate && disk) {
        return (
            <div className={`metric-card metric-card--disk ${spanClass}`}>
                <DiskRow disk={disk} isInline={isInline} />
            </div>
        );
    }

    // ── Collapsed aggregate card ──
    const aggregateUsage = getAggregateUsage(disks);
    const maxTemp = getMaxTemp(disks);
    const unhealthyDisks = disks.filter((d) => d.status !== 'ok');
    const aggregateTooltip = buildAggregateTooltip(disks, isInline);


    const cardProps = {
        ref: triggerRef,
        className: `metric-card metric-card--disk metric-card--disk-aggregate ${spanClass}`,
        role: 'button' as const,
        tabIndex: 0,
    };

    // Compute aggregate byte totals for bar labels
    let aggTotalSize = 0;
    let aggTotalUsed = 0;
    for (const d of disks) {
        if (d.fsSize !== null && d.fsFree !== null) {
            aggTotalSize += d.fsSize;
            aggTotalUsed += d.fsSize - d.fsFree;
        }
    }
    const aggFreeBytes = aggTotalSize - aggTotalUsed;

    const progressBar = (
        <div className="metric-card__progress metric-card__progress--labeled" title={aggregateTooltip}>
            <div
                className="metric-card__progress-fill"
                style={{
                    width: `${aggregateUsage}%`,
                    backgroundColor: getUsageColor(aggregateUsage),
                }}
            >
                {aggTotalUsed > 0 && (
                    <span className="metric-card__bar-label metric-card__bar-label--used">{formatBytes(aggTotalUsed)}</span>
                )}
            </div>
            {aggFreeBytes > 0 && (
                <span className="metric-card__bar-label metric-card__bar-label--free">{formatBytes(aggFreeBytes)}</span>
            )}
        </div>
    );

    const cardContent = (
        <div className="metric-card__inner">
            <div className="metric-card__header">
                <span className="metric-card__label">
                    <HardDrive size={14} />
                    Disks
                    <DiskWarningIndicator unhealthyDisks={unhealthyDisks} />
                    {!isInline && maxTemp !== null && (
                        <span className="metric-card__disk-temp">
                            {maxTemp}°C
                        </span>
                    )}
                    <ChevronDown
                        size={12}
                        className={`metric-card__disk-chevron ${popoverOpen ? 'metric-card__disk-chevron--open' : ''}`}
                    />
                </span>
                <span className="metric-card__value">
                    {aggregateUsage}%
                </span>
            </div>
            {progressBar}
        </div>
    );

    return (
        <Popover
            open={popoverOpen}
            onOpenChange={setPopoverOpen}
            closeOnScroll={false}
        >
            <Popover.Trigger asChild>
                <div {...cardProps}>{cardContent}</div>
            </Popover.Trigger>
            <Popover.Content
                side="bottom"
                align="center"
                sideOffset={6}
                className="disk-popover"
                maxHeight="300px"
            >
                <div
                    className="disk-popover__list"
                    style={{
                        width: triggerWidth ? Math.max(triggerWidth, 200) : 200,
                    }}
                >
                    {disks.map((d) => (
                        <div key={d.id} className="disk-popover__item metric-card metric-card--disk">
                            <DiskRow disk={d} isInline={isInline} />
                        </div>
                    ))}
                    {disks.length === 0 && (
                        <div className="disk-popover__empty">No disks selected</div>
                    )}
                </div>
            </Popover.Content>
        </Popover>
    );
};

export default DiskMetricCard;

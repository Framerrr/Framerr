/**
 * Downloads Widget - Stats Bar
 *
 * Shared stats bar for both qBittorrent and SABnzbd.
 * - Shows download count + download speed for both clients
 * - Upload speed + popovers only shown for qBittorrent
 * - Global pause/resume button for admins
 */

import React, { useRef, useCallback, useLayoutEffect } from 'react';
import { Download, ArrowDown, ArrowUp, Pause, Play } from 'lucide-react';
import { Popover } from '@/shared/ui';
import { usePopoverState } from '../../hooks/usePopoverState';
import { formatSpeed, formatBytes } from './utils';
import type { ClientType } from './utils';

// ============================================================================
// TYPES
// ============================================================================

interface StatsBarProps {
    clientType: ClientType;
    itemCount: number;
    totalDown: number;
    totalUp: number;
    transferInfo: {
        dl_info_speed?: number;
        dl_info_data?: number;
        alltime_dl?: number;
        up_info_speed?: number;
        up_info_data?: number;
        alltime_ul?: number;
    } | null;
    /** Whether there are active (non-paused) items */
    hasActiveItems: boolean;
    /** Admin-only global pause/resume */
    isAdmin: boolean;
    globalActionLoading: boolean;
    onGlobalToggle: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const StatsBar: React.FC<StatsBarProps> = ({
    clientType,
    itemCount,
    totalDown,
    totalUp,
    transferInfo,
    hasActiveItems,
    isAdmin,
    globalActionLoading,
    onGlobalToggle,
}) => {
    const isQbt = clientType === 'qbittorrent';

    // Popover state for transfer stats (qBittorrent only)
    const { isOpen: dlPopoverOpen, onOpenChange: handleDlPopoverChange } = usePopoverState();
    const { isOpen: ulPopoverOpen, onOpenChange: handleUlPopoverChange } = usePopoverState();

    // Detect which stats items start a new wrapped row and mark them
    const statsBarRef = useRef<HTMLDivElement>(null);
    const updateWrapClasses = useCallback(() => {
        const el = statsBarRef.current;
        if (!el) return;
        const children = Array.from(el.querySelectorAll('.qbt-stats-item'));
        let firstTop = -1;
        children.forEach((child, i) => {
            const top = (child as HTMLElement).getBoundingClientRect().top;
            if (i === 0) {
                firstTop = top;
            } else if (Math.abs(top - firstTop) > 5) {
                child.classList.add('wrap-start');
            } else {
                child.classList.remove('wrap-start');
            }
        });
    }, []);

    useLayoutEffect(() => {
        updateWrapClasses();
        const el = statsBarRef.current;
        if (!el) return;
        const ro = new ResizeObserver(updateWrapClasses);
        ro.observe(el);
        return () => ro.disconnect();
    }, [updateWrapClasses]);

    // Re-apply wrap classes after every render
    useLayoutEffect(() => {
        updateWrapClasses();
    });

    const itemLabel = isQbt ? 'torrents' : 'downloads';

    return (
        <>
            <div className="qbt-stats-wrapper">
                <div ref={statsBarRef} className="qbt-stats-bar">
                    {/* Item count */}
                    <div className="qbt-stats-item">
                        <Download size={12} />
                        <span className="qbt-stats-value">{itemCount}</span>
                        <span className="qbt-stats-label">{itemLabel}</span>
                    </div>

                    {/* Download speed — always shown */}
                    {isQbt ? (
                        <Popover open={dlPopoverOpen} onOpenChange={handleDlPopoverChange}>
                            <Popover.Trigger asChild>
                                <button className="qbt-stats-item qbt-stats-clickable">
                                    <ArrowDown size={12} />
                                    <span className="qbt-stats-value qbt-speed-down">{formatSpeed(totalDown)}</span>
                                </button>
                            </Popover.Trigger>
                            <Popover.Content side="bottom" align="center" sideOffset={4} className="min-w-max">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-4">
                                        <span className="text-theme-secondary">Download Speed:</span>
                                        <span className="text-success font-semibold">
                                            {formatSpeed(transferInfo?.dl_info_speed || totalDown)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-theme-secondary">Session Total:</span>
                                        <span className="text-theme-primary font-medium">
                                            {formatBytes(transferInfo?.dl_info_data || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-theme-secondary">Global Total:</span>
                                        <span className="text-theme-primary font-medium">
                                            {formatBytes(transferInfo?.alltime_dl || 0)}
                                        </span>
                                    </div>
                                </div>
                            </Popover.Content>
                        </Popover>
                    ) : (
                        <div className="qbt-stats-item">
                            <ArrowDown size={12} />
                            <span className="qbt-stats-value qbt-speed-down">{formatSpeed(totalDown)}</span>
                        </div>
                    )}

                    {/* Upload speed — qBittorrent only */}
                    {isQbt && (
                        <Popover open={ulPopoverOpen} onOpenChange={handleUlPopoverChange}>
                            <Popover.Trigger asChild>
                                <button className="qbt-stats-item qbt-stats-clickable">
                                    <ArrowUp size={12} />
                                    <span className="qbt-stats-value qbt-speed-up">{formatSpeed(totalUp)}</span>
                                </button>
                            </Popover.Trigger>
                            <Popover.Content side="bottom" align="center" sideOffset={4} className="min-w-max">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-4">
                                        <span className="text-theme-secondary">Upload Speed:</span>
                                        <span className="text-info font-semibold">
                                            {formatSpeed(transferInfo?.up_info_speed || totalUp)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-theme-secondary">Session Total:</span>
                                        <span className="text-theme-primary font-medium">
                                            {formatBytes(transferInfo?.up_info_data || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-theme-secondary">Global Total:</span>
                                        <span className="text-theme-primary font-medium">
                                            {formatBytes(transferInfo?.alltime_ul || 0)}
                                        </span>
                                    </div>
                                </div>
                            </Popover.Content>
                        </Popover>
                    )}
                </div>

                {/* Global Play/Pause — admin only */}
                {isAdmin && (
                    <button
                        className={`qbt-global-control ${globalActionLoading ? 'is-loading' : ''}`}
                        onClick={onGlobalToggle}
                        title={hasActiveItems ? `Pause all ${itemLabel}` : `Resume all ${itemLabel}`}
                        aria-label={hasActiveItems ? 'Pause all' : 'Resume all'}
                    >
                        {hasActiveItems ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                )}
            </div>

            {/* Divider between stats and list */}
            <div className="qbt-divider" />
        </>
    );
};

export default StatsBar;

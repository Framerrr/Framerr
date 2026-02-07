import React, { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Popover } from '@/shared/ui';
import { WidgetStateMessage, useWidgetIntegration, useIntegrationSSE } from '../../shared/widgets';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import { usePopoverState } from '../../hooks/usePopoverState';
import type { WidgetProps } from '../types';

interface QBittorrentWidgetProps extends WidgetProps {
    // No additional props needed
}

interface Torrent {
    hash: string;
    name: string;
    state: string;
    progress: number;
    size: number;
    dlspeed: number;
    upspeed: number;
    added_on: number;
    [key: string]: unknown;
}

interface TransferInfo {
    dl_info_speed?: number;
    dl_info_data?: number;
    alltime_dl?: number;
    up_info_speed?: number;
    up_info_data?: number;
    alltime_ul?: number;
}

interface QBittorrentIntegration {
    enabled?: boolean;
    url?: string;
    username?: string;
    password?: string;
}

// Preview mode mock torrents
const PREVIEW_TORRENTS = [
    { name: 'Ubuntu.24.04.LTS', progress: 85, size: 4200000000, dlspeed: 15000000 },
    { name: 'Fedora.Workstation', progress: 42, size: 3100000000, dlspeed: 8500000 },
    { name: 'Debian.12.iso', progress: 100, size: 2800000000, dlspeed: 0 },
];

const QBittorrentWidget: React.FC<QBittorrentWidgetProps> = ({ widget, previewMode = false }) => {
    // Preview mode: render mock torrent list without hooks
    if (previewMode) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div className="bg-theme-tertiary text-center p-2 rounded-lg">
                        <div className="text-theme-secondary">Total</div>
                        <div style={{ fontWeight: 600 }} className="text-theme-primary">24</div>
                    </div>
                    <div className="bg-success/10 text-center p-2 rounded-lg">
                        <div className="text-theme-secondary">↓ 23.5 MB/s</div>
                        <div style={{ fontWeight: 600 }} className="text-success">2 DL</div>
                    </div>
                    <div className="bg-info/10 text-center p-2 rounded-lg">
                        <div className="text-theme-secondary">↑ 5.2 MB/s</div>
                        <div style={{ fontWeight: 600 }} className="text-info">3 UP</div>
                    </div>
                </div>
                {/* Torrent List */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {PREVIEW_TORRENTS.map((t, i) => (
                        <div key={i} className="bg-theme-tertiary p-2 rounded-lg" style={{ fontSize: '0.75rem' }}>
                            <div className="font-semibold mb-1 text-theme-primary" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {t.name}
                            </div>
                            <div className="bg-theme-hover h-1 rounded-full mb-1 overflow-hidden">
                                <div style={{ width: `${t.progress}%`, height: '100%' }} className={t.progress < 100 ? 'bg-success' : 'bg-theme-secondary'} />
                            </div>
                            <div className="flex justify-between text-theme-secondary">
                                <span>{t.progress}% • {(t.size / 1000000000).toFixed(1)} GB</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Get auth state to determine admin status
    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    // Check if integration is bound (new pattern: explicit integrationId in config)
    const config = widget.config as { integrationId?: string } | undefined;
    const configuredIntegrationId = config?.integrationId;

    // Use unified access hook for widget + integration access
    const {
        effectiveIntegrationId,
        status: accessStatus,
        loading: accessLoading,
    } = useWidgetIntegration('qbittorrent', configuredIntegrationId, widget.id);

    // Use the effective integration ID (may be fallback)
    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;

    // PATTERN: usePopoverState (see docs/refactor/PATTERNS.md UI-001)
    const { isOpen: dlPopoverOpen, onOpenChange: handleDlPopoverChange } = usePopoverState();
    const { isOpen: ulPopoverOpen, onOpenChange: handleUlPopoverChange } = usePopoverState();

    // State for widget - populated by SSE subscription
    const [torrents, setTorrents] = useState<Torrent[]>([]);
    const [transferInfo, setTransferInfo] = useState<TransferInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<string>('added_on');
    const [sortDesc, setSortDesc] = useState<boolean>(true);
    const [limit, setLimit] = useState<number>(20);

    // Phase 24: Use reusable SSE hook for real-time updates
    interface QBittorrentSSEData {
        torrents: Torrent[];
        transferInfo: TransferInfo | null;
    }

    // P9: Also get isConnected to prevent premature empty state
    const { loading, isConnected } = useIntegrationSSE<QBittorrentSSEData>({
        integrationType: 'qbittorrent',
        integrationId,
        enabled: isIntegrationBound,
        onData: (sseData) => {
            if (sseData && Array.isArray(sseData.torrents)) {
                setTorrents(sseData.torrents);
                setTransferInfo(sseData.transferInfo);
                setError(null);
            }
        },
        onError: (err) => {
            setError(err.message);
        },
    });

    // NOW we can have early returns (after all hooks have been called)

    // Handle access loading state
    if (accessLoading) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Widget not shared to user
    if (accessStatus === 'noAccess') {
        return (
            <WidgetStateMessage
                variant="noAccess"
                serviceName="qBittorrent"
            />
        );
    }

    // Widget shared but no integrations available
    if (accessStatus === 'disabled') {
        return (
            <WidgetStateMessage
                variant="disabled"
                serviceName="qBittorrent"
                isAdmin={userIsAdmin}
            />
        );
    }

    // No integration configured
    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return (
            <WidgetStateMessage
                variant="notConfigured"
                serviceName="qBittorrent"
                isAdmin={userIsAdmin}
            />
        );
    }

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1000; // Use decimal (1000) to match qBittorrent/VueTorrent
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const formatSpeed = (bytesPerSec: number): string => formatBytes(bytesPerSec) + '/s';



    // P9: Show loading while SSE not connected OR waiting for first data
    if ((loading && torrents.length === 0) || (!isConnected && torrents.length === 0)) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (error) {
        // Use 'unavailable' variant for connection/service errors from backend
        const isServiceUnavailable = error.includes('unavailable') || error.includes('Unable to reach');
        return (
            <WidgetStateMessage
                variant={isServiceUnavailable ? 'unavailable' : 'error'}
                serviceName="qBittorrent"
                message={isServiceUnavailable ? undefined : error}
            />
        );
    }

    // Sort torrents
    const sortedTorrents = [...torrents].sort((a, b) => {
        const aVal = a[sortBy] as number;
        const bVal = b[sortBy] as number;
        return sortDesc ? (bVal - aVal) : (aVal - bVal);
    }).slice(0, limit);

    const activeTorrents = torrents.filter(t => ['downloading', 'uploading'].includes(t.state));
    const totalDown = activeTorrents.reduce((sum, t) => sum + (t.dlspeed || 0), 0);
    const totalUp = activeTorrents.reduce((sum, t) => sum + (t.upspeed || 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
                {/* Total */}
                <div className="bg-theme-tertiary text-center p-2 rounded-lg">
                    <div className="text-theme-secondary">Total</div>
                    <div style={{ fontWeight: 600 }} className="text-theme-primary">{torrents.length}</div>
                </div>

                {/* Download Stats - Popover */}
                <Popover open={dlPopoverOpen} onOpenChange={handleDlPopoverChange}>
                    <Popover.Trigger asChild>
                        <button
                            className="bg-success/10 text-center p-2 rounded-lg transition-all hover:bg-success/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/50"
                            aria-label="Download statistics"
                        >
                            <div className="text-theme-secondary">↓ {formatSpeed(totalDown)}</div>
                            <div style={{ fontWeight: 600 }} className="text-success">
                                {activeTorrents.filter(t => t.state === 'downloading').length} DL
                            </div>
                        </button>
                    </Popover.Trigger>

                    <Popover.Content
                        side="bottom"
                        align="center"
                        sideOffset={4}
                        className="min-w-max"
                    >
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

                {/* Upload Stats - Popover */}
                <Popover open={ulPopoverOpen} onOpenChange={handleUlPopoverChange}>
                    <Popover.Trigger asChild>
                        <button
                            className="bg-info/10 text-center p-2 rounded-lg transition-all hover:bg-info/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/50"
                            aria-label="Upload statistics"
                        >
                            <div className="text-theme-secondary">↑ {formatSpeed(totalUp)}</div>
                            <div style={{ fontWeight: 600 }} className="text-info">
                                {activeTorrents.filter(t => t.state === 'uploading').length} UP
                            </div>
                        </button>
                    </Popover.Trigger>

                    <Popover.Content
                        side="bottom"
                        align="center"
                        sideOffset={4}
                        className="min-w-max"
                    >
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
            </div>

            {/* Torrent List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sortedTorrents.length === 0 ? (
                    <div className="text-theme-secondary">No active torrents</div>
                ) : (
                    sortedTorrents.map(torrent => {
                        const progress = (torrent.progress * 100).toFixed(1);
                        const isActive = ['downloading', 'uploading'].includes(torrent.state);

                        return (
                            <div
                                key={torrent.hash}
                                className="bg-theme-tertiary p-2 rounded-lg"
                                style={{ fontSize: '0.75rem' }}
                            >
                                <div className="font-semibold mb-1 text-theme-primary" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {torrent.name}
                                </div>

                                {/* Progress Bar */}
                                <div className="bg-theme-hover h-1 rounded-full mb-1 overflow-hidden">
                                    <div style={{
                                        width: `${progress}%`,
                                        height: '100%',
                                        transition: 'width 0.3s ease'
                                    }} className={isActive ? 'bg-success' : 'bg-theme-secondary'} />
                                </div>

                                <div className="flex justify-between text-theme-secondary">
                                    <span>{progress}% • {formatBytes(torrent.size)}</span>
                                    {isActive && (
                                        <span>
                                            <ArrowDown size={12} style={{ display: 'inline' }} /> {formatSpeed(torrent.dlspeed)}
                                            {' '}
                                            <ArrowUp size={12} style={{ display: 'inline' }} /> {formatSpeed(torrent.upspeed)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default QBittorrentWidget;

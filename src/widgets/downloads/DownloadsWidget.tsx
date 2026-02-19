/**
 * Downloads Widget
 *
 * Unified wrapper for qBittorrent and SABnzbd downloads.
 * Detects the bound integration type and adapts rendering:
 *
 * - qBittorrent: flat sorted list of torrents
 * - SABnzbd: Queue section + History section (with smart header visibility)
 *
 * Shared components (StatsBar, DownloadCard) handle visual differences
 * with clientType conditionals — no duplicated rendering code.
 */

import React, { useState, useCallback, useRef } from 'react';
import { CheckCircle2, Download } from 'lucide-react';
import { WidgetStateMessage, useWidgetIntegration, useIntegrationSSE } from '../../shared/widgets';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';
import StatsBar from './StatsBar';
import DownloadCard from './DownloadCard';
import TorrentDetailModal from './TorrentDetailModal';
import SabDetailModal from './SabDetailModal';
import type { Torrent } from './types';
import type { ClientType } from './utils';
import type { WidgetProps } from '../types';
import './styles.css';

// ============================================================================
// TYPES
// ============================================================================

interface TransferInfo {
    dl_info_speed?: number;
    dl_info_data?: number;
    alltime_dl?: number;
    up_info_speed?: number;
    up_info_data?: number;
    alltime_ul?: number;
}

/** SABnzbd queue item shape from the poller */
interface SABQueueItem {
    nzo_id: string;
    filename: string;
    status: string;
    mb: string;
    mbleft: string;
    percentage: string;
    timeleft: string;
    cat: string;
    priority: string;
    avg_age: string;
    labels: string[];
    script: string;
}

/** SABnzbd history item shape from the poller */
interface SABHistoryItem {
    nzo_id: string;
    name: string;
    status: string;
    bytes: number;
    download_time: number;
    completed: number;
    category: string;
    fail_message: string;
    storage: string;
}

interface SABnzbdSSEData {
    queue: SABQueueItem[];
    history: SABHistoryItem[];
    queueInfo: {
        status: string;
        speed: number;
        totalMb: number;
        remainingMb: number;
        paused: boolean;
        speedlimit: string;
        totalSlots: number;
    } | null;
}

interface QBittorrentSSEData {
    torrents: Torrent[];
    transferInfo: TransferInfo | null;
}

// ============================================================================
// PREVIEW
// ============================================================================

function PreviewWidget() {
    return (
        <div className="qbt-widget">
            <div className="qbt-stats-bar">
                <div className="qbt-stats-item">
                    <Download size={12} />
                    <span className="qbt-stats-value">24</span>
                    <span className="qbt-stats-label">downloads</span>
                </div>
            </div>
            <div className="qbt-torrent-list">
                {[
                    { name: 'Ubuntu.24.04.LTS.iso', pct: 85, speed: '15 MB/s' },
                    { name: 'Fedora.Workstation.41', pct: 42, speed: '8.5 MB/s' },
                    { name: 'Debian.12.iso', pct: 100, speed: '' },
                ].map(t => (
                    <div key={t.name} className="qbt-torrent-card">
                        <div className="qbt-torrent-header">
                            <div className="qbt-status-badge">
                                <div className={`qbt-status-dot ${t.pct === 100 ? 'seeding' : 'downloading'}`} />
                            </div>
                            <span className="qbt-torrent-name">{t.name}</span>
                            {t.speed && (
                                <div className="qbt-torrent-speed">
                                    <span className="qbt-speed-down">↓ {t.speed}</span>
                                </div>
                            )}
                        </div>
                        <div className="qbt-torrent-footer">
                            <div className="qbt-progress-bar">
                                <div
                                    className={`qbt-progress-fill ${t.pct === 100 ? 'seeding' : 'downloading'}`}
                                    style={{ width: `${t.pct}%` }}
                                />
                            </div>
                            <span className="qbt-torrent-meta">{t.pct}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// MAIN WIDGET
// ============================================================================

const DownloadsWidget: React.FC<WidgetProps> = ({ widget, previewMode = false }) => {
    if (previewMode) return <PreviewWidget />;

    const { user } = useAuth();
    const userIsAdmin = isAdmin(user);

    const config = widget.config as { integrationId?: string; showStatsBar?: string } | undefined;
    const configuredIntegrationId = config?.integrationId;
    const showStatsBar = config?.showStatsBar !== 'false';

    // Use the 'downloads' widget type — the hook resolves compatible integrations
    const {
        effectiveIntegrationId,
        status: accessStatus,
        loading: accessLoading,
        availableIntegrations,
    } = useWidgetIntegration('downloads', configuredIntegrationId, widget.id);

    const integrationId = effectiveIntegrationId || undefined;
    const isIntegrationBound = !!integrationId;

    // Detect client type from the bound integration
    const clientType: ClientType = (() => {
        if (!integrationId) return 'qbittorrent'; // Default
        const bound = availableIntegrations.find(i => i.id === integrationId);
        return (bound?.type as ClientType) || 'qbittorrent';
    })();

    const isQbt = clientType === 'qbittorrent';

    // ---------- State ----------
    // qBittorrent state
    const [torrents, setTorrents] = useState<Torrent[]>([]);
    const [transferInfo, setTransferInfo] = useState<TransferInfo | null>(null);
    // SABnzbd state
    const [sabQueue, setSabQueue] = useState<SABQueueItem[]>([]);
    const [sabHistory, setSabHistory] = useState<SABHistoryItem[]>([]);
    const [sabQueueInfo, setSabQueueInfo] = useState<SABnzbdSSEData['queueInfo']>(null);
    // Shared state
    const [error, setError] = useState<string | null>(null);
    const [globalActionLoading, setGlobalActionLoading] = useState(false);

    // Modal state — store hash/nzoId, derive from live data
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selectedTorrent = isQbt ? (torrents.find(t => t.hash === selectedId) || null) : null;
    const selectedSabItem = !isQbt ? (sabQueue.find(i => i.nzo_id === selectedId) || null) : null;

    // Suppress stale SSE updates briefly after optimistic actions
    const optimisticUntil = useRef(0);

    // ---------- SSE ----------
    const { loading, isConnected } = useIntegrationSSE<QBittorrentSSEData | SABnzbdSSEData>({
        integrationType: clientType,
        integrationId,
        enabled: isIntegrationBound,
        onData: (sseData) => {
            if (!sseData) return;
            if (Date.now() < optimisticUntil.current) return;

            if (isQbt) {
                const data = sseData as QBittorrentSSEData;
                if (Array.isArray(data.torrents)) {
                    setTorrents(data.torrents);
                    setTransferInfo(data.transferInfo);
                    setError(null);
                }
            } else {
                const data = sseData as SABnzbdSSEData;
                if (Array.isArray(data.queue)) {
                    setSabQueue(data.queue);
                    setSabHistory(data.history || []);
                    setSabQueueInfo(data.queueInfo);
                    setError(null);
                }
            }
        },
        onError: (err) => {
            setError(err.message);
        },
    });

    // ---------- Computed ----------
    const itemCount = isQbt ? torrents.length : sabQueue.length + sabHistory.length;

    // For SABnzbd, the global pause state comes from queueInfo.paused flag,
    // not individual item statuses (items can show 'Downloading' while globally paused)
    const hasActiveItems = isQbt
        ? torrents.some(t => ['downloading', 'uploading', 'forcedDL', 'forcedUP', 'metaDL', 'stalledDL', 'stalledUP'].includes(t.state))
        : sabQueueInfo ? !sabQueueInfo.paused && sabQueue.some(i => i.status.toLowerCase() === 'downloading') : false;

    const activeDL = isQbt
        ? torrents.filter(t => ['downloading', 'metaDL', 'forcedDL'].includes(t.state))
        : [];
    const activeUP = isQbt
        ? torrents.filter(t => ['uploading', 'forcedUP'].includes(t.state))
        : [];
    const totalDown = isQbt
        ? (transferInfo?.dl_info_speed ?? activeDL.reduce((s, t) => s + (t.dlspeed || 0), 0))
        : (sabQueueInfo?.speed ?? 0);
    const totalUp = isQbt
        ? (transferInfo?.up_info_speed ?? activeUP.reduce((s, t) => s + (t.upspeed || 0), 0))
        : 0;

    // ---------- Global Pause/Resume ----------
    const handleGlobalToggle = useCallback(async () => {
        if (!integrationId || globalActionLoading) return;
        setGlobalActionLoading(true);
        const wasPausing = hasActiveItems;

        try {
            if (isQbt) {
                const action = wasPausing ? 'pause' : 'resume';
                const resp = await fetch(`/api/integrations/${integrationId}/proxy/torrents/${action}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Framerr-Client': '1' },
                    credentials: 'include',
                    body: JSON.stringify({ hashes: ['all'] }),
                });
                if (resp.ok) {
                    optimisticUntil.current = Date.now() + 1500;
                    setTorrents(prev => prev.map(t => ({
                        ...t,
                        state: wasPausing
                            ? (t.state.includes('DL') ? 'pausedDL' : 'pausedUP')
                            : (t.progress < 1 ? 'downloading' : 'uploading'),
                        dlspeed: wasPausing ? 0 : t.dlspeed,
                        upspeed: wasPausing ? 0 : t.upspeed,
                    })));
                }
            } else {
                const action = wasPausing ? 'pause' : 'resume';
                const resp = await fetch(`/api/integrations/${integrationId}/proxy/sab/${action}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Framerr-Client': '1' },
                    credentials: 'include',
                    body: JSON.stringify({}),
                });
                if (resp.ok) {
                    optimisticUntil.current = Date.now() + 1500;
                    // Flip the queueInfo paused flag immediately
                    setSabQueueInfo(prev => prev ? { ...prev, paused: wasPausing, speed: wasPausing ? 0 : prev.speed } : prev);
                    // Also flip individual item statuses so cards show yellow/green
                    setSabQueue(prev => prev.map(item => {
                        if (wasPausing && item.status === 'Downloading') {
                            return { ...item, status: 'Paused' };
                        }
                        if (!wasPausing && item.status === 'Paused') {
                            return { ...item, status: 'Downloading' };
                        }
                        return item;
                    }));
                }
            }
        } catch {
            // SSE will show the actual state shortly
        } finally {
            setGlobalActionLoading(false);
        }
    }, [integrationId, globalActionLoading, hasActiveItems, isQbt]);

    // ---------- Early returns (after all hooks) ----------
    const serviceName = isQbt ? 'qBittorrent' : 'SABnzbd';

    if (accessLoading) return <WidgetStateMessage variant="loading" />;
    if (accessStatus === 'noAccess') return <WidgetStateMessage variant="noAccess" serviceName={serviceName} />;
    if (accessStatus === 'disabled') return <WidgetStateMessage variant="disabled" serviceName={serviceName} isAdmin={userIsAdmin} />;
    if (accessStatus === 'notConfigured' || !isIntegrationBound) {
        return <WidgetStateMessage variant="notConfigured" serviceName="Downloads" isAdmin={userIsAdmin} />;
    }

    const hasData = isQbt ? torrents.length > 0 : (sabQueue.length > 0 || sabHistory.length > 0);
    if ((loading && !hasData) || (!isConnected && !hasData)) {
        return <WidgetStateMessage variant="loading" />;
    }

    if (error) {
        const isServiceUnavailable = error.includes('unavailable') || error.includes('Unable to reach');
        return (
            <WidgetStateMessage
                variant={isServiceUnavailable ? 'unavailable' : 'error'}
                serviceName={serviceName}
                message={isServiceUnavailable ? undefined : error}
            />
        );
    }

    // ---------- Render ----------

    const sortedTorrents = isQbt
        ? [...torrents].sort((a, b) => b.added_on - a.added_on).slice(0, 50)
        : [];

    // SABnzbd section header visibility: only show when BOTH sections have items
    const showSabHeaders = !isQbt && sabQueue.length > 0 && sabHistory.length > 0;

    return (
        <div className="qbt-widget">
            {/* Stats Bar */}
            {showStatsBar && (
                <StatsBar
                    clientType={clientType}
                    itemCount={itemCount}
                    totalDown={totalDown}
                    totalUp={totalUp}
                    transferInfo={isQbt ? transferInfo : null}
                    hasActiveItems={hasActiveItems}
                    isAdmin={userIsAdmin}
                    globalActionLoading={globalActionLoading}
                    onGlobalToggle={handleGlobalToggle}
                />
            )}

            {/* Download List */}
            <div className="qbt-torrent-list">
                {isQbt ? (
                    /* qBittorrent: flat sorted list */
                    sortedTorrents.length === 0 ? (
                        <div className="qbt-empty-state">
                            <CheckCircle2 size={24} />
                            <span>No torrents</span>
                        </div>
                    ) : (
                        sortedTorrents.map(torrent => (
                            <DownloadCard
                                key={torrent.hash}
                                id={torrent.hash}
                                name={torrent.name}
                                status={torrent.state}
                                progress={torrent.progress}
                                size={torrent.size}
                                dlspeed={torrent.dlspeed}
                                upspeed={torrent.upspeed}
                                eta={torrent.eta}
                                ratio={torrent.ratio}
                                clientType="qbittorrent"
                                variant="active"
                                onClick={userIsAdmin ? () => setSelectedId(torrent.hash) : undefined}
                            />
                        ))
                    )
                ) : (
                    /* SABnzbd: Queue + History sections */
                    sabQueue.length === 0 && sabHistory.length === 0 ? (
                        <div className="qbt-empty-state">
                            <CheckCircle2 size={24} />
                            <span>No downloads</span>
                        </div>
                    ) : (
                        <>
                            {/* Queue section */}
                            {sabQueue.length > 0 && (
                                <>
                                    {showSabHeaders && (
                                        <div className="qbt-section-header">Queue</div>
                                    )}
                                    {sabQueue.map(item => (
                                        <DownloadCard
                                            key={item.nzo_id}
                                            id={item.nzo_id}
                                            name={item.filename}
                                            status={item.status}
                                            progress={parseFloat(item.percentage || '0') / 100}
                                            size={parseFloat(item.mb || '0') * 1000 * 1000}
                                            dlspeed={0} // Speed is global, not per-item in SABnzbd
                                            upspeed={0}
                                            eta={0} // TODO: parse timeleft string
                                            ratio={0}
                                            clientType="sabnzbd"
                                            variant="active"
                                            onClick={userIsAdmin ? () => setSelectedId(item.nzo_id) : undefined}
                                        />
                                    ))}
                                </>
                            )}

                            {/* History section */}
                            {sabHistory.length > 0 && (
                                <>
                                    {showSabHeaders && (
                                        <div className="qbt-section-header">History</div>
                                    )}
                                    {sabHistory.map(item => (
                                        <DownloadCard
                                            key={item.nzo_id}
                                            id={item.nzo_id}
                                            name={item.name}
                                            status={item.status}
                                            progress={item.status === 'Completed' ? 1 : 0}
                                            size={item.bytes}
                                            dlspeed={0}
                                            upspeed={0}
                                            eta={0}
                                            ratio={0}
                                            clientType="sabnzbd"
                                            variant="history"
                                            completedAt={item.completed}
                                            downloadTime={item.download_time}
                                            category={item.category}
                                        />
                                    ))}
                                </>
                            )}
                        </>
                    )
                )}
            </div>

            {/* Detail Modal — qBittorrent */}
            {isQbt && userIsAdmin && selectedTorrent && integrationId && (
                <TorrentDetailModal
                    torrent={selectedTorrent}
                    integrationId={integrationId}
                    open={!!selectedTorrent}
                    onOpenChange={(open: boolean) => { if (!open) setSelectedId(null); }}
                    onTorrentUpdate={(hash: string, updates: Partial<Torrent> | null) => {
                        optimisticUntil.current = Date.now() + 1500;
                        if (updates === null) {
                            setTorrents(prev => prev.filter(t => t.hash !== hash));
                            setSelectedId(null);
                        } else {
                            setTorrents(prev => prev.map(t =>
                                t.hash === hash ? { ...t, ...updates } : t
                            ));
                        }
                    }}
                />
            )}

            {/* Detail Modal — SABnzbd (queue items only) */}
            {!isQbt && userIsAdmin && selectedSabItem && integrationId && (
                <SabDetailModal
                    item={selectedSabItem}
                    integrationId={integrationId}
                    open={!!selectedSabItem}
                    onOpenChange={(open: boolean) => { if (!open) setSelectedId(null); }}
                    onItemUpdate={(nzoId: string, updates) => {
                        optimisticUntil.current = Date.now() + 1500;
                        if (updates === null) {
                            setSabQueue(prev => prev.filter(i => i.nzo_id !== nzoId));
                            setSelectedId(null);
                        } else {
                            setSabQueue(prev => prev.map(i =>
                                i.nzo_id === nzoId ? { ...i, ...updates } : i
                            ));
                        }
                    }}
                />
            )}
        </div>
    );
};

export default DownloadsWidget;

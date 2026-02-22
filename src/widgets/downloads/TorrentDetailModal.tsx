import React, { useState, useEffect, useCallback } from 'react';
import {
    Play, Pause, RefreshCw, Trash2, FastForward, FileText, Radio, Info
} from 'lucide-react';
import { Modal } from '@/shared/ui';
import { Select } from '@/shared/ui/Select/Select';
import { Button } from '@/shared/ui/Button/Button';
import { formatBytes, formatSpeed, formatEta, getQbtStateClass as getStateClass, getQbtStateLabel as getStateLabel } from './utils';
import type { Torrent } from './types';
import './styles.css';

// ============================================================================
// TYPES
// ============================================================================

interface TorrentDetailModalProps {
    torrent: Torrent;
    integrationId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Optimistic callback: update the torrent in the parent list after an action */
    onTorrentUpdate?: (hash: string, updates: Partial<Torrent> | null) => void;
}

interface TorrentProperties {
    save_path?: string;
    creation_date?: number;
    piece_size?: number;
    comment?: string;
    total_wasted?: number;
    total_uploaded?: number;
    total_downloaded?: number;
    nb_connections?: number;
    nb_connections_limit?: number;
    share_ratio?: number;
    addition_date?: number;
    completion_date?: number;
    created_by?: string;
    dl_speed_avg?: number;
    up_speed_avg?: number;
    seeds?: number;
    seeds_total?: number;
    peers?: number;
    peers_total?: number;
    pieces_have?: number;
    pieces_num?: number;
    seeding_time?: number;
    isPrivate?: boolean;
    time_elapsed?: number;
}

interface TorrentTracker {
    url: string;
    status: number;
    tier: number;
    num_peers: number;
    num_seeds: number;
    num_leeches: number;
    num_downloaded: number;
    msg: string;
}

interface TorrentFile {
    index: number;
    name: string;
    size: number;
    progress: number;
    priority: number;
    availability: number;
}

interface GeneralData {
    properties: TorrentProperties;
    trackers: TorrentTracker[];
    files: TorrentFile[];
}

type TabId = 'overview' | 'files' | 'trackers';

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(timestamp: number): string {
    if (!timestamp || timestamp <= 0) return '—';
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function trackerStatusDot(status: number): string {
    switch (status) {
        case 0: return 'paused';    // disabled
        case 1: return 'queued';    // not contacted yet
        case 2: return 'seeding';   // working
        case 3: return 'checking';  // updating
        case 4: return 'error';     // not working
        default: return 'stalled';
    }
}

function trackerStatusLabel(status: number): string {
    switch (status) {
        case 0: return 'Disabled';
        case 1: return 'Not contacted';
        case 2: return 'Working';
        case 3: return 'Updating';
        case 4: return 'Not working';
        default: return 'Unknown';
    }
}

const PRIORITY_LABELS: Record<number, string> = {
    0: 'Skip',
    1: 'Normal',
    6: 'High',
    7: 'Maximum',
};

// ============================================================================
// COMPONENT
// ============================================================================

const TorrentDetailModal: React.FC<TorrentDetailModalProps> = ({
    torrent,
    integrationId,
    open,
    onOpenChange,
    onTorrentUpdate,
}) => {
    const [tab, setTab] = useState<TabId>('overview');
    const [data, setData] = useState<GeneralData | null>(null);
    const [dataLoading, setDataLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    // Fetch combined data on open
    useEffect(() => {
        if (!open || !torrent.hash) return;
        setDataLoading(true);
        setData(null);
        setTab('overview');
        setDeleteConfirm(false);

        fetch(`/api/integrations/${integrationId}/proxy/torrents/${torrent.hash}/general`, {
            credentials: 'include',
        })
            .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load')))
            .then((d: GeneralData) => setData(d))
            .catch(() => { /* silently fail, show basic info from torrent prop */ })
            .finally(() => setDataLoading(false));
    }, [open, torrent.hash, integrationId]);

    // ---------- Actions ----------

    /** Fire-and-forget action — no loading state, optimistic update handles UI */
    const postAction = useCallback(async (
        endpoint: string,
        body: Record<string, unknown>,
    ) => {
        await fetch(`/api/integrations/${integrationId}/proxy/torrents/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Framerr-Client': '1' },
            credentials: 'include',
            body: JSON.stringify(body),
        });
    }, [integrationId]);

    const handlePause = async () => {
        onTorrentUpdate?.(torrent.hash, {
            state: torrent.state.includes('DL') ? 'pausedDL' : 'pausedUP',
            dlspeed: 0, upspeed: 0,
        });
        postAction('pause', { hashes: [torrent.hash] });
    };
    const handleResume = async () => {
        onTorrentUpdate?.(torrent.hash, {
            state: torrent.progress < 1 ? 'downloading' : 'uploading',
        });
        postAction('resume', { hashes: [torrent.hash] });
    };
    const handleForceStart = async () => {
        onTorrentUpdate?.(torrent.hash, {
            state: torrent.progress < 1 ? 'forcedDL' : 'forcedUP',
        });
        postAction('setForceStart', { hashes: [torrent.hash], value: true });
    };
    const handleRecheck = async () => {
        onTorrentUpdate?.(torrent.hash, { state: 'checkingDL' });
        postAction('recheck', { hashes: [torrent.hash] });
    };

    const handleDelete = async (deleteFiles: boolean) => {
        setDeleteLoading(true);
        try {
            await postAction('delete', { hashes: [torrent.hash], deleteFiles });
            onTorrentUpdate?.(torrent.hash, null);
            setDeleteConfirm(false);
            onOpenChange(false);
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleFilePriority = async (fileIndex: number, priority: number) => {
        await postAction('filePrio', { hash: torrent.hash, id: [fileIndex], priority });
        // Update local state immediately
        if (data) {
            setData({
                ...data,
                files: data.files.map(f =>
                    f.index === fileIndex ? { ...f, priority } : f
                ),
            });
        }
    };

    // ---------- Derived ----------

    const stateClass = getStateClass(torrent.state);
    const stateLabel = getStateLabel(torrent.state);
    const pct = torrent.progress * 100;
    // Use RAW qBittorrent state for pause/resume button — not our normalized class
    // because pausedUP maps to 'completed' visually but is still paused in qBittorrent
    const isPaused = torrent.state.startsWith('paused') || torrent.state.startsWith('stopped');
    const isActive = stateClass === 'downloading' || stateClass === 'seeding';
    const props = data?.properties;

    return (
        <Modal open={open} onOpenChange={onOpenChange} size="lg">
            {/* Hero Section */}
            <div className="qbt-modal-hero" style={{ padding: '1.25rem 1.25rem 0.75rem' }}>
                <div className="qbt-modal-hero-header">
                    <div className="qbt-modal-hero-name">{torrent.name}</div>
                    <div className="qbt-modal-hero-status">
                        <div className={`qbt-status-dot ${stateClass}`} />
                        <span style={{ color: stateClass === 'downloading' ? '#3b82f6' : stateClass === 'seeding' ? '#67b8f0' : stateClass === 'completed' ? '#22c55e' : stateClass === 'stalled' ? '#f59e0b' : stateClass === 'error' ? 'var(--error)' : stateClass === 'paused' ? 'var(--warning)' : 'var(--text-secondary)' }}>
                            {stateLabel}
                        </span>
                    </div>
                </div>

                <div className="qbt-modal-progress">
                    <div className="qbt-progress-bar" style={{ height: '6px', borderRadius: '3px' }}>
                        <div
                            className={`qbt-progress-fill ${stateClass}`}
                            style={{ width: `${pct.toFixed(1)}%`, borderRadius: '3px' }}
                        />
                    </div>
                    <div className="qbt-modal-progress-info">
                        <span>{formatBytes(torrent.downloaded || torrent.size * torrent.progress)} / {formatBytes(torrent.total_size || torrent.size)}</span>
                        <span>{pct < 100 ? `${pct.toFixed(1)}%` : '100%'}</span>
                    </div>
                </div>

                {(torrent.dlspeed > 0 || torrent.upspeed > 0 || (torrent.eta > 0 && torrent.eta < 8640000)) && (
                    <div className="qbt-modal-speeds">
                        {torrent.dlspeed > 0 && <span className="qbt-speed-down">↓ {formatSpeed(torrent.dlspeed)}</span>}
                        {torrent.upspeed > 0 && <span className="qbt-speed-up">↑ {formatSpeed(torrent.upspeed)}</span>}
                        {torrent.eta > 0 && torrent.eta < 8640000 && (
                            <span style={{ color: 'var(--text-secondary)' }}>ETA: {formatEta(torrent.eta)}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs — outside Modal.Body so they stay pinned on short viewports */}
            <div className="qbt-modal-tabs flex-shrink-0" style={{ padding: '0 1.25rem' }}>
                {([
                    { id: 'overview' as TabId, label: 'Overview', icon: <Info size={13} /> },
                    { id: 'files' as TabId, label: `Files${data ? ` (${data.files.length})` : ''}`, icon: <FileText size={13} /> },
                    { id: 'trackers' as TabId, label: `Trackers${data ? ` (${data.trackers.filter(t => t.url.startsWith('http') || t.url.startsWith('udp')).length})` : ''}`, icon: <Radio size={13} /> },
                ]).map(t => (
                    <button
                        key={t.id}
                        className={`qbt-modal-tab ${tab === t.id ? 'active' : ''}`}
                        onClick={() => setTab(t.id)}
                    >
                        {t.icon}
                        <span style={{ marginLeft: '0.3rem' }}>{t.label}</span>
                    </button>
                ))}
            </div>

            <Modal.Body padded={false}>
                {/* Tab Content */}
                <div className="qbt-modal-tab-content" style={{ padding: '0.75rem 1.25rem', minHeight: '40vh' }}>
                    {dataLoading && <div className="qbt-empty-state"><span>Loading details…</span></div>}

                    {/* Overview Tab */}
                    {!dataLoading && tab === 'overview' && (
                        <div className="qbt-detail-grid">
                            <span className="qbt-detail-label">Ratio</span>
                            <span className="qbt-detail-value">×{(torrent.ratio || 0).toFixed(2)}</span>

                            <span className="qbt-detail-label">Seeds</span>
                            <span className="qbt-detail-value">
                                {props ? `${props.seeds ?? '—'} / ${props.seeds_total ?? '—'}` : `${torrent.num_seeds ?? '—'}`}
                            </span>

                            <span className="qbt-detail-label">Peers</span>
                            <span className="qbt-detail-value">
                                {props ? `${props.peers ?? '—'} / ${props.peers_total ?? '—'}` : `${torrent.num_leechs ?? '—'}`}
                            </span>

                            <span className="qbt-detail-label">Added</span>
                            <span className="qbt-detail-value">{formatDate(torrent.added_on)}</span>

                            {torrent.completion_on > 0 && (
                                <>
                                    <span className="qbt-detail-label">Completed</span>
                                    <span className="qbt-detail-value">{formatDate(torrent.completion_on)}</span>
                                </>
                            )}

                            <span className="qbt-detail-label">Active Time</span>
                            <span className="qbt-detail-value">{formatDuration(props?.time_elapsed ?? torrent.time_active ?? 0)}</span>

                            {props?.seeding_time != null && props.seeding_time > 0 && (
                                <>
                                    <span className="qbt-detail-label">Seeding Time</span>
                                    <span className="qbt-detail-value">{formatDuration(props.seeding_time)}</span>
                                </>
                            )}

                            {torrent.category && (
                                <>
                                    <span className="qbt-detail-label">Category</span>
                                    <span className="qbt-detail-value">
                                        <span className="qbt-pill">{torrent.category}</span>
                                    </span>
                                </>
                            )}

                            {torrent.tags && (
                                <>
                                    <span className="qbt-detail-label">Tags</span>
                                    <span className="qbt-detail-value">
                                        <span className="qbt-pills">
                                            {torrent.tags.split(',').map(tag => (
                                                <span key={tag.trim()} className="qbt-pill">{tag.trim()}</span>
                                            ))}
                                        </span>
                                    </span>
                                </>
                            )}

                            <span className="qbt-detail-label">Save Path</span>
                            <span className="qbt-detail-value" title={props?.save_path ?? torrent.save_path}>
                                {props?.save_path ?? torrent.save_path ?? '—'}
                            </span>

                            {props && (
                                <>
                                    <span className="qbt-detail-label">Connections</span>
                                    <span className="qbt-detail-value">{props.nb_connections ?? '—'} / {props.nb_connections_limit ?? '—'}</span>
                                </>
                            )}

                            <span className="qbt-detail-label">DL Limit</span>
                            <span className="qbt-detail-value">{torrent.dl_limit > 0 ? formatSpeed(torrent.dl_limit) : '∞'}</span>

                            <span className="qbt-detail-label">UL Limit</span>
                            <span className="qbt-detail-value">{torrent.up_limit > 0 ? formatSpeed(torrent.up_limit) : '∞'}</span>

                            {props?.total_wasted != null && props.total_wasted > 0 && (
                                <>
                                    <span className="qbt-detail-label">Wasted</span>
                                    <span className="qbt-detail-value">{formatBytes(props.total_wasted)}</span>
                                </>
                            )}

                            {props?.piece_size != null && (
                                <>
                                    <span className="qbt-detail-label">Piece Size</span>
                                    <span className="qbt-detail-value">{formatBytes(props.piece_size)}</span>
                                </>
                            )}

                            {props?.isPrivate != null && (
                                <>
                                    <span className="qbt-detail-label">Private</span>
                                    <span className="qbt-detail-value">{props.isPrivate ? 'Yes' : 'No'}</span>
                                </>
                            )}

                            {props?.created_by && (
                                <>
                                    <span className="qbt-detail-label">Created By</span>
                                    <span className="qbt-detail-value">{props.created_by}</span>
                                </>
                            )}

                            {props?.comment && (
                                <>
                                    <span className="qbt-detail-label">Comment</span>
                                    <span className="qbt-detail-value" style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                                        {props.comment}
                                    </span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Files Tab */}
                    {!dataLoading && tab === 'files' && data && (
                        <div className="qbt-file-list">
                            {[...data.files]
                                .sort((a, b) => b.size - a.size)
                                .map(file => (
                                    <div key={file.index} className="qbt-file-item">
                                        <div className="qbt-file-header">
                                            <FileText size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                            <span className="qbt-file-name" title={file.name}>
                                                {file.name.split('/').pop() || file.name}
                                            </span>
                                            <span className="qbt-file-size">{formatBytes(file.size)}</span>
                                        </div>
                                        <div className="qbt-file-footer">
                                            <div className="qbt-progress-bar">
                                                <div
                                                    className="qbt-progress-fill downloading"
                                                    style={{ width: `${(file.progress * 100).toFixed(1)}%` }}
                                                />
                                            </div>
                                            <span className="qbt-file-progress-pct">
                                                {(file.progress * 100).toFixed(0)}%
                                            </span>
                                            <Select
                                                value={String(file.priority)}
                                                onValueChange={(val) => handleFilePriority(file.index, Number(val))}
                                            >
                                                <Select.Trigger size="sm" className="qbt-file-priority-trigger">
                                                    <Select.Value />
                                                </Select.Trigger>
                                                <Select.Content side="bottom" align="end" sideOffset={4}>
                                                    {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                                                        <Select.Item key={val} value={val}>{label}</Select.Item>
                                                    ))}
                                                </Select.Content>
                                            </Select>
                                        </div>
                                    </div>
                                ))}
                            {data.files.length === 0 && (
                                <div className="qbt-empty-state"><span>No files</span></div>
                            )}
                        </div>
                    )}

                    {/* Trackers Tab */}
                    {!dataLoading && tab === 'trackers' && data && (
                        <div className="qbt-tracker-list">
                            {data.trackers
                                .filter(t => t.url.startsWith('http') || t.url.startsWith('udp'))
                                .map((tracker, idx) => (
                                    <div key={idx} className="qbt-tracker-item">
                                        <div className="qbt-tracker-header">
                                            <div className={`qbt-status-dot ${trackerStatusDot(tracker.status)}`}
                                                style={{ width: '7px', height: '7px' }}
                                                title={trackerStatusLabel(tracker.status)}
                                            />
                                            <span className="qbt-tracker-url">{tracker.url}</span>
                                        </div>
                                        <div className="qbt-tracker-stats">
                                            <span>Seeds: {tracker.num_seeds >= 0 ? tracker.num_seeds : '—'}</span>
                                            <span>Peers: {tracker.num_peers >= 0 ? tracker.num_peers : '—'}</span>
                                            {tracker.num_downloaded > 0 && (
                                                <span>DL'd: {tracker.num_downloaded.toLocaleString()}</span>
                                            )}
                                        </div>
                                        {tracker.msg && (
                                            <span className="qbt-tracker-msg">{tracker.msg}</span>
                                        )}
                                    </div>
                                ))}
                            {data.trackers.filter(t => t.url.startsWith('http') || t.url.startsWith('udp')).length === 0 && (
                                <div className="qbt-empty-state"><span>No trackers</span></div>
                            )}
                        </div>
                    )}

                    {!dataLoading && !data && tab !== 'overview' && (
                        <div className="qbt-empty-state"><span>Could not load details</span></div>
                    )}
                </div>
            </Modal.Body>

            {/* Footer: Delete Confirmation or Actions */}
            <Modal.Footer className={deleteConfirm ? 'justify-center' : 'justify-start'}>
                {deleteConfirm ? (
                    <div className="qbt-confirm-delete" style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, color: 'var(--error)' }}>
                            Remove torrent from qBittorrent?
                        </p>
                        <div className="qbt-confirm-delete-actions">
                            <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={deleteLoading}
                                loading={deleteLoading}
                                onClick={() => handleDelete(false)}
                            >
                                Keep Files
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                disabled={deleteLoading}
                                loading={deleteLoading}
                                onClick={() => handleDelete(true)}
                            >
                                Delete Files
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {isPaused ? (
                            <Button variant="secondary" size="sm" icon={Play} onClick={handleResume}>
                                Resume
                            </Button>
                        ) : (
                            <Button variant="secondary" size="sm" icon={Pause} onClick={handlePause}>
                                Pause
                            </Button>
                        )}

                        {!isActive && (
                            <Button variant="secondary" size="sm" icon={FastForward} onClick={handleForceStart}>
                                Force Start
                            </Button>
                        )}

                        <Button
                            variant="secondary"
                            size="sm"
                            icon={RefreshCw}
                            className={stateClass === 'checking' ? 'qbt-spin-icon' : ''}
                            onClick={handleRecheck}
                        >
                            Recheck
                        </Button>

                        <div style={{ flex: 1 }} />

                        <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteConfirm(true)}>
                            Delete
                        </Button>
                    </>
                )}
            </Modal.Footer>
        </Modal>
    );
};

export default TorrentDetailModal;

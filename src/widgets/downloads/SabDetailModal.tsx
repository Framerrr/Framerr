/**
 * SABnzbd Detail Modal
 *
 * Admin-only modal for SABnzbd download details.
 * Shows queue item info with two tabs:
 *   - Overview: priority, category, size, labels, age
 *   - Files: file listing from get_files API
 *
 * Actions: Pause/Resume, Change Priority, Delete
 * Reuses the same CSS classes as TorrentDetailModal for visual consistency.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Play, Pause, Trash2, FileText, Info
} from 'lucide-react';
import { Modal } from '@/shared/ui';
import { Select } from '@/shared/ui/Select/Select';
import { Button } from '@/shared/ui/Button/Button';
import { formatBytes, getSabStateClass, getSabStateLabel } from './utils';
import './styles.css';

// ============================================================================
// TYPES
// ============================================================================

export interface SabQueueItem {
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

interface SabDetailModalProps {
    item: SabQueueItem;
    integrationId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onItemUpdate?: (nzoId: string, updates: Partial<SabQueueItem> | null) => void;
}

/** File from SABnzbd get_files API */
interface SabFile {
    id: number;
    nzf_id: string;
    filename: string;
    bytes: number;
    age: string;
    status: string;
}

/** Server from SABnzbd server_stats API */
interface SabServer {
    [serverName: string]: {
        total: number;
        articles_tried?: number;
        articles_success?: number;
    };
}

interface SabGeneralData {
    files: { files?: SabFile[] };
    servers: { total?: number; servers?: Record<string, SabServer> };
}

type TabId = 'overview' | 'files';

// ============================================================================
// HELPERS
// ============================================================================

const SAB_PRIORITY_LABELS: Record<string, string> = {
    '-1': 'Low',
    '0': 'Normal',
    '1': 'High',
    '2': 'Force',
};

function priorityToNumber(priority: string): number {
    // SABnzbd sends priority as text sometimes ("Normal", "High") or as number string
    const map: Record<string, number> = {
        'low': -1, 'normal': 0, 'high': 1, 'force': 2,
        '-1': -1, '0': 0, '1': 1, '2': 2,
    };
    return map[priority.toLowerCase()] ?? 0;
}

// ============================================================================
// COMPONENT
// ============================================================================

const SabDetailModal: React.FC<SabDetailModalProps> = ({
    item,
    integrationId,
    open,
    onOpenChange,
    onItemUpdate,
}) => {
    const [tab, setTab] = useState<TabId>('overview');
    const [data, setData] = useState<SabGeneralData | null>(null);
    const [dataLoading, setDataLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    // Fetch combined data (files + servers) on open
    useEffect(() => {
        if (!open || !item.nzo_id) return;
        setDataLoading(true);
        setData(null);
        setTab('overview');
        setDeleteConfirm(false);

        fetch(`/api/integrations/${integrationId}/proxy/sab/general/${item.nzo_id}`, {
            credentials: 'include',
        })
            .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load')))
            .then((d: SabGeneralData) => setData(d))
            .catch(() => { /* silently fail, show basic info from item prop */ })
            .finally(() => setDataLoading(false));
    }, [open, item.nzo_id, integrationId]);

    // ---------- Actions ----------

    const postAction = useCallback(async (
        action: string,
        body: Record<string, unknown>,
    ) => {
        await fetch(`/api/integrations/${integrationId}/proxy/sab/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Framerr-Client': '1' },
            credentials: 'include',
            body: JSON.stringify(body),
        });
    }, [integrationId]);

    const handlePause = async () => {
        onItemUpdate?.(item.nzo_id, { status: 'Paused' });
        postAction('pause', { nzoId: item.nzo_id });
    };

    const handleResume = async () => {
        onItemUpdate?.(item.nzo_id, { status: 'Downloading' });
        postAction('resume', { nzoId: item.nzo_id });
    };

    const handlePriorityChange = async (newPriority: string) => {
        const priLabel = SAB_PRIORITY_LABELS[newPriority] || 'Normal';
        onItemUpdate?.(item.nzo_id, { priority: priLabel });
        postAction('priority', { nzoId: item.nzo_id, priority: Number(newPriority) });
    };

    const handleDelete = async (deleteFiles: boolean) => {
        setDeleteLoading(true);
        try {
            await postAction('delete', { nzoId: item.nzo_id, deleteFiles });
            onItemUpdate?.(item.nzo_id, null); // null = remove from list
            setDeleteConfirm(false);
            onOpenChange(false);
        } finally {
            setDeleteLoading(false);
        }
    };

    // ---------- Derived ----------

    const stateClass = getSabStateClass(item.status);
    const stateLabel = getSabStateLabel(item.status);
    const pct = parseFloat(item.percentage || '0');
    const totalMb = parseFloat(item.mb || '0');
    const remainingMb = parseFloat(item.mbleft || '0');
    const downloadedBytes = (totalMb - remainingMb) * 1000 * 1000;
    const totalBytes = totalMb * 1000 * 1000;
    const isPaused = stateClass === 'paused';
    const currentPriority = String(priorityToNumber(item.priority));

    // Files from the API
    const files: SabFile[] = (data?.files as unknown as { files?: SabFile[] })?.files || [];

    return (
        <Modal open={open} onOpenChange={onOpenChange} size="lg">
            {/* Hero Section — identical layout to TorrentDetailModal */}
            <div className="qbt-modal-hero" style={{ padding: '1.25rem 1.25rem 0.75rem' }}>
                <div className="qbt-modal-hero-header">
                    <div className="qbt-modal-hero-name">{item.filename}</div>
                    <div className="qbt-modal-hero-status">
                        <div className={`qbt-status-dot ${stateClass}`} />
                        <span style={{ color: `var(--${stateClass === 'downloading' ? 'success' : stateClass === 'processing' ? 'accent' : stateClass === 'error' ? 'error' : stateClass === 'paused' ? 'warning' : 'text-secondary'})` }}>
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
                        <span>{formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}</span>
                        <span>{pct < 100 ? `${pct.toFixed(1)}%` : '100%'}</span>
                    </div>
                </div>

                {item.timeleft && item.timeleft !== '0:00:00' && (
                    <div className="qbt-modal-speeds">
                        <span style={{ color: 'var(--text-secondary)' }}>ETA: {item.timeleft}</span>
                    </div>
                )}
            </div>

            {/* Tabs — outside Modal.Body so they stay pinned on short viewports */}
            <div className="qbt-modal-tabs flex-shrink-0" style={{ padding: '0 1.25rem' }}>
                {([
                    { id: 'overview' as TabId, label: 'Overview', icon: <Info size={13} /> },
                    { id: 'files' as TabId, label: `Files${files.length > 0 ? ` (${files.length})` : ''}`, icon: <FileText size={13} /> },
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
                            <span className="qbt-detail-label">Priority</span>
                            <span className="qbt-detail-value">
                                <span className="qbt-pill">{SAB_PRIORITY_LABELS[currentPriority] || item.priority}</span>
                            </span>

                            <span className="qbt-detail-label">Category</span>
                            <span className="qbt-detail-value">
                                {item.cat ? <span className="qbt-pill">{item.cat}</span> : '—'}
                            </span>

                            <span className="qbt-detail-label">Total Size</span>
                            <span className="qbt-detail-value">{formatBytes(totalBytes)}</span>

                            <span className="qbt-detail-label">Remaining</span>
                            <span className="qbt-detail-value">{formatBytes(remainingMb * 1000 * 1000)}</span>

                            {item.avg_age && (
                                <>
                                    <span className="qbt-detail-label">Age</span>
                                    <span className="qbt-detail-value">{item.avg_age}</span>
                                </>
                            )}

                            {item.timeleft && item.timeleft !== '0:00:00' && (
                                <>
                                    <span className="qbt-detail-label">Time Left</span>
                                    <span className="qbt-detail-value">{item.timeleft}</span>
                                </>
                            )}

                            {item.script && item.script !== 'Default' && (
                                <>
                                    <span className="qbt-detail-label">Post-Script</span>
                                    <span className="qbt-detail-value">{item.script}</span>
                                </>
                            )}

                            {item.labels && item.labels.length > 0 && (
                                <>
                                    <span className="qbt-detail-label">Labels</span>
                                    <span className="qbt-detail-value">
                                        <span className="qbt-pills">
                                            {item.labels.map(label => (
                                                <span
                                                    key={label}
                                                    className="qbt-pill"
                                                    style={label === 'DUPLICATE' || label === 'ENCRYPTED'
                                                        ? { background: 'var(--error)', color: 'var(--text-primary)' }
                                                        : undefined}
                                                >
                                                    {label}
                                                </span>
                                            ))}
                                        </span>
                                    </span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Files Tab */}
                    {!dataLoading && tab === 'files' && (
                        <div className="qbt-file-list">
                            {files.length > 0
                                ? [...files]
                                    .sort((a, b) => b.bytes - a.bytes)
                                    .map((file, idx) => (
                                        <div key={file.nzf_id || idx} className="qbt-file-item">
                                            <div className="qbt-file-header">
                                                <FileText size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                                <span className="qbt-file-name" title={file.filename}>
                                                    {file.filename?.split('/').pop() || file.filename}
                                                </span>
                                                <span className="qbt-file-size">{formatBytes(file.bytes)}</span>
                                            </div>
                                            {file.status && (
                                                <div className="qbt-file-footer">
                                                    <span className="qbt-file-progress-pct" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                        {file.status}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                : <div className="qbt-empty-state"><span>No files</span></div>
                            }
                        </div>
                    )}

                    {!dataLoading && !data && tab === 'files' && (
                        <div className="qbt-empty-state"><span>Could not load details</span></div>
                    )}
                </div>
            </Modal.Body>

            {/* Footer: Delete Confirmation or Actions */}
            <Modal.Footer className={deleteConfirm ? 'justify-center' : 'justify-start'}>
                {deleteConfirm ? (
                    <div className="qbt-confirm-delete" style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, color: 'var(--error)' }}>
                            Remove download from SABnzbd?
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

                        {/* Priority selector */}
                        <Select
                            value={currentPriority}
                            onValueChange={handlePriorityChange}
                        >
                            <Select.Trigger size="sm">
                                <Select.Value />
                            </Select.Trigger>
                            <Select.Content>
                                {Object.entries(SAB_PRIORITY_LABELS).map(([val, label]) => (
                                    <Select.Item key={val} value={val}>{label}</Select.Item>
                                ))}
                            </Select.Content>
                        </Select>

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

export default SabDetailModal;

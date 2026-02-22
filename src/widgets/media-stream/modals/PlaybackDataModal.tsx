import React from 'react';
import { Wifi, WifiOff, Activity, Tv, HardDrive, LucideIcon } from 'lucide-react';
import { Modal } from '../../../shared/ui';
import type { PlaybackInfo } from '../adapters/types';

interface PlaybackDataModalProps {
    playbackInfo: PlaybackInfo | undefined;
    onClose: () => void;
}

const PlaybackDataModal: React.FC<PlaybackDataModalProps> = ({ playbackInfo, onClose }) => {
    if (!playbackInfo) return null;

    // Determine connection type
    const hasLocation = playbackInfo.location != null;
    const isLAN = playbackInfo.location === 'lan';
    const ConnectionIcon: LucideIcon = isLAN ? Wifi : WifiOff;
    const connectionColor = isLAN ? 'var(--success)' : 'var(--warning)';

    // Format bandwidth
    const bandwidth = playbackInfo.bandwidth
        ? `${(playbackInfo.bandwidth / 1000).toFixed(1)} Mbps`
        : undefined;

    // Video decision
    const videoDecision = playbackInfo.videoDecision || 'directplay';
    const videoColor = videoDecision === 'directplay' ? 'var(--success)'
        : videoDecision === 'copy' ? 'var(--info)'
            : 'var(--warning)';
    const videoText = videoDecision === 'directplay' ? 'Direct Play'
        : videoDecision === 'copy' ? 'Direct Stream'
            : videoDecision === 'transcode' ? 'Transcode'
                : videoDecision;

    // Audio decision
    const audioDecision = playbackInfo.audioDecision || 'directplay';
    const audioColor = audioDecision === 'directplay' ? 'var(--success)'
        : audioDecision === 'copy' ? 'var(--info)'
            : 'var(--warning)';
    const audioText = audioDecision === 'directplay' ? 'Direct Play'
        : audioDecision === 'copy' ? 'Direct Stream'
            : audioDecision === 'transcode' ? 'Transcode'
                : audioDecision;

    return (
        <Modal open={true} onOpenChange={(open) => !open && onClose()} size="sm">
            <Modal.Header title="Playback Data" />
            <Modal.Body>
                <div className="space-y-6">
                    {/* Network Section */}
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            <ConnectionIcon size={16} style={{ color: hasLocation ? connectionColor : 'var(--text-secondary)' }} />
                            Network
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {playbackInfo.ipAddress && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>IP Address:</span>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{playbackInfo.ipAddress}</span>
                                </div>
                            )}
                            {hasLocation && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Connection:</span>
                                    <span style={{ fontWeight: 500, color: connectionColor }}>
                                        {isLAN ? 'LAN' : 'WAN'}
                                    </span>
                                </div>
                            )}
                            {bandwidth && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Bandwidth:</span>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{bandwidth}</span>
                                </div>
                            )}
                            {!playbackInfo.ipAddress && !hasLocation && !bandwidth && (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                    No network data available
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Video Section */}
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            <Tv size={16} />
                            Video
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Decision:</span>
                                <span style={{ fontWeight: 500, color: videoColor }}>
                                    {videoText}
                                </span>
                            </div>
                            {playbackInfo.videoCodec && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Codec:</span>
                                    <span style={{ fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                                        {playbackInfo.videoCodec}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Audio Section */}
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            <Activity size={16} />
                            Audio
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Decision:</span>
                                <span style={{ fontWeight: 500, color: audioColor }}>
                                    {audioText}
                                </span>
                            </div>
                            {playbackInfo.audioCodec && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Codec:</span>
                                    <span style={{ fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                                        {playbackInfo.audioCodec}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Client Section */}
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            <HardDrive size={16} />
                            Client
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {playbackInfo.device && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Device:</span>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{playbackInfo.device}</span>
                                </div>
                            )}
                            {playbackInfo.platform && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Platform:</span>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{playbackInfo.platform}</span>
                                </div>
                            )}
                            {playbackInfo.application && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Application:</span>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{playbackInfo.application}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default PlaybackDataModal;

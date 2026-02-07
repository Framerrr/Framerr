import React from 'react';
import { Wifi, WifiOff, Activity, Tv, HardDrive, LucideIcon } from 'lucide-react';
import { Modal } from '../../../shared/ui';

interface Player {
    address?: string;
    device?: string;
    platform?: string;
    product?: string;
}

interface SessionData {
    location?: string;
    bandwidth?: number;
}

interface TranscodeSession {
    videoDecision?: string;
    audioDecision?: string;
    videoCodec?: string;
    audioCodec?: string;
}

interface PlexSession {
    Player?: Player;
    Session?: SessionData;
    TranscodeSession?: TranscodeSession;
    Media?: Record<string, unknown>;
}

interface PlaybackDataModalProps {
    session: PlexSession | null;
    onClose: () => void;
}

const PlaybackDataModal: React.FC<PlaybackDataModalProps> = ({ session, onClose }) => {
    if (!session) return null;

    const { Player, Session: SessionData, TranscodeSession } = session;

    // Determine connection type
    const isLAN = SessionData?.location === 'lan';
    const ConnectionIcon: LucideIcon = isLAN ? Wifi : WifiOff;
    const connectionColor = isLAN ? 'var(--success)' : 'var(--warning)';

    // Format bandwidth
    const bandwidth = SessionData?.bandwidth
        ? `${(SessionData.bandwidth / 1000).toFixed(1)} Mbps`
        : 'Unknown';

    // Video decision - No TranscodeSession means Direct Play
    const videoDecision = TranscodeSession?.videoDecision || (TranscodeSession ? 'Unknown' : 'directplay');
    const videoColor = videoDecision === 'directplay' ? 'var(--success)'
        : videoDecision === 'copy' ? 'var(--info)'
            : 'var(--warning)';
    const videoText = videoDecision === 'directplay' ? 'Direct Play'
        : videoDecision === 'copy' ? 'Direct Stream'
            : videoDecision === 'transcode' ? 'Transcode'
                : videoDecision;

    // Audio decision - No TranscodeSession means Direct Play
    const audioDecision = TranscodeSession?.audioDecision || (TranscodeSession ? 'Unknown' : 'directplay');
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
                            <ConnectionIcon size={16} style={{ color: connectionColor }} />
                            Network
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>IP Address:</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{Player?.address || 'Unknown'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Connection:</span>
                                <span style={{ fontWeight: 500, color: connectionColor }}>
                                    {isLAN ? 'LAN' : 'WAN'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Bandwidth:</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{bandwidth}</span>
                            </div>
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
                            {TranscodeSession?.videoCodec && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Codec:</span>
                                    <span style={{ fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                                        {TranscodeSession.videoCodec}
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
                            {TranscodeSession?.audioCodec && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Codec:</span>
                                    <span style={{ fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                                        {TranscodeSession.audioCodec}
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
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Device:</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{Player?.device || 'Unknown'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Platform:</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{Player?.platform || 'Unknown'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Application:</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{Player?.product || 'Unknown'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default PlaybackDataModal;


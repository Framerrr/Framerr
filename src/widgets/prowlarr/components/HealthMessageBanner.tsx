/**
 * HealthMessageBanner — Prowlarr /health messages as Sonarr-style attention rows.
 */

import React from 'react';
import type { ProwlarrHealthMessage } from '../prowlarr.types';

interface HealthMessageBannerProps {
    healthMessages: ProwlarrHealthMessage[];
}

function severityClass(type: ProwlarrHealthMessage['type']): string {
    if (type === 'error') return 'error';
    if (type === 'warning') return 'warning';
    return 'notice';
}

/** Prowlarr health `source` is a check class name (e.g. IndexerNoDefinitionCheck). */
function humanizeHealthSource(source: string): string {
    return source
        .replace(/Check$/i, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .trim();
}

const HealthMessageBanner: React.FC<HealthMessageBannerProps> = ({ healthMessages }) => {
    if (healthMessages.length === 0) return null;

    return (
        <div className="prwl-health-list" role="status">
            {healthMessages.map((msg, idx) => (
                <div
                    key={`${msg.source}-${idx}`}
                    className={`prwl-attention-item prwl-attention-item--${severityClass(msg.type)}`}
                >
                    <div className="prwl-attention-info">
                        <span className="prwl-attention-title">{msg.message}</span>
                        {msg.source && (
                            <span className="prwl-attention-meta" title={msg.source}>
                                {humanizeHealthSource(msg.source)}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default HealthMessageBanner;

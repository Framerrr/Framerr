/**
 * ApplicationsStrip — one-row compact cards matching Service Status language.
 * Logo + name/sync stack + status dot on the right. Overflow → "+N more".
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { Boxes } from 'lucide-react';
import { renderIcon } from '../../../utils/iconUtils';
import type { ProwlarrApplication } from '../prowlarr.types';

interface ApplicationsStripProps {
    applications: ProwlarrApplication[];
}

const CARD_MIN_PX = 96;
const MORE_CHIP_PX = 48;
const GAP_PX = 6;

function resolveAppIcon(app: ProwlarrApplication): string {
    const haystack = `${app.implementation} ${app.name}`.toLowerCase();
    if (haystack.includes('sonarr')) return 'system:sonarr';
    if (haystack.includes('radarr')) return 'system:radarr';
    if (haystack.includes('lidarr')) return 'system:lidarr';
    if (haystack.includes('prowlarr')) return 'system:prowlarr';
    return '';
}

function formatSyncStatus(syncLevel: string): { synced: boolean; label: string } {
    const level = (syncLevel || '').trim().toLowerCase();
    if (!level || level === 'disabled') {
        return { synced: false, label: 'Disabled' };
    }
    if (level === 'addon' || level === 'addonly') {
        return { synced: true, label: 'Add only' };
    }
    if (level === 'fullsync') {
        return { synced: true, label: 'Synced' };
    }
    return { synced: true, label: syncLevel };
}

const ApplicationsStrip: React.FC<ApplicationsStripProps> = ({ applications }) => {
    const rowRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(applications.length);

    useLayoutEffect(() => {
        const el = rowRef.current;
        if (!el || applications.length === 0) return;

        const measure = () => {
            const width = el.clientWidth;
            if (width <= 0) return;

            let fit = Math.max(1, Math.floor((width + GAP_PX) / (CARD_MIN_PX + GAP_PX)));
            if (fit >= applications.length) {
                setVisibleCount(applications.length);
                return;
            }

            fit = Math.max(1, Math.floor((width - MORE_CHIP_PX - GAP_PX + GAP_PX) / (CARD_MIN_PX + GAP_PX)));
            setVisibleCount(Math.min(fit, applications.length - 1));
        };

        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [applications.length]);

    if (applications.length === 0) return null;

    const visible = applications.slice(0, visibleCount);
    const overflow = applications.length - visible.length;

    return (
        <div className="prwl-apps" ref={rowRef} aria-label="Connected applications">
            {visible.map((app) => {
                const iconValue = resolveAppIcon(app);
                const sync = formatSyncStatus(app.syncLevel);

                return (
                    <div
                        key={app.id}
                        className="prwl-app-card"
                        title={`${app.name} · ${sync.label}`}
                    >
                        <div className="prwl-app-logo">
                            {iconValue ? (
                                renderIcon(iconValue, 18, 'prwl-app-logo-img')
                            ) : (
                                <Boxes size={16} className="text-accent" />
                            )}
                        </div>
                        <div className="prwl-app-text">
                            <span className="prwl-app-name">{app.name}</span>
                            <span
                                className={`prwl-app-sync ${sync.synced ? 'prwl-app-sync--on' : 'prwl-app-sync--off'}`}
                            >
                                {sync.label}
                            </span>
                        </div>
                        <span
                            className={`prwl-app-status-dot ${sync.synced ? 'prwl-app-status-dot--on' : 'prwl-app-status-dot--off'}`}
                            aria-hidden
                        />
                    </div>
                );
            })}
            {overflow > 0 && (
                <div
                    className="prwl-app-more"
                    title={applications.slice(visibleCount).map((a) => a.name).join(', ')}
                >
                    +{overflow}
                </div>
            )}
        </div>
    );
};

export default ApplicationsStrip;

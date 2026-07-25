import React from 'react';
import { Loader, CheckCircle2, XCircle } from 'lucide-react';
import { getIconComponent } from '@/utils/iconUtils';
import { triggerHaptic } from '@/utils/haptics';
import { useDashboardEdit } from '@/context/useDashboardEdit';
import { guardedNavigate } from '@/settings/navigation/settingsConfig';
import { resolveLinkNavigation } from '@/widgets/link-grid/utils/linkNavigation';
import { useLinkAction } from '@/widgets/link-grid/hooks/useLinkAction';
import type { Link } from '@/widgets/link-grid/types';

export interface TabBarLinkButtonProps {
    link: Link;
    onMenuClose: () => void;
}

export function TabBarLinkButton({ link, onMenuClose }: TabBarLinkButtonProps): React.JSX.Element {
    const dashboardEdit = useDashboardEdit();
    const { state, execute } = useLinkAction(link);
    const Icon = getIconComponent(link.icon);
    const iconSize = 24;
    const isLoading = state === 'loading';
    const isSuccess = state === 'success';
    const isError = state === 'error';

    const caption = (
        <span className="text-[10px] font-medium truncate max-w-[4.5rem] relative z-10">
            {link.title}
        </span>
    );

    const renderActionIcon = (): React.ReactNode => {
        if (isLoading) return <Loader size={iconSize} className="text-accent animate-spin" />;
        if (isSuccess) return <CheckCircle2 size={iconSize} className="text-success" />;
        if (isError) return <XCircle size={iconSize} className="text-error" />;
        return <Icon size={iconSize} className="text-theme-secondary" />;
    };

    if (link.type === 'action') {
        return (
            <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                    triggerHaptic();
                    void execute();
                }}
                className="flex flex-col items-center gap-1 transition-colors py-2 px-3 rounded-xl relative text-theme-tertiary active:text-theme-primary"
            >
                <div className="relative z-10">{renderActionIcon()}</div>
                {caption}
            </button>
        );
    }

    const nav = resolveLinkNavigation(link);

    if (nav.kind === 'hash' && nav.hash) {
        return (
            <a
                href={`#${nav.hash}`}
                onClick={(e) => {
                    e.preventDefault();
                    triggerHaptic();
                    const destination = `#${nav.hash}`;
                    const result = guardedNavigate(destination, dashboardEdit);
                    if (result === 'proceed' && nav.hash) {
                        window.location.hash = nav.hash;
                    }
                    onMenuClose();
                }}
                className="flex flex-col items-center gap-1 transition-colors py-2 px-3 rounded-xl relative text-theme-tertiary active:text-theme-primary"
            >
                <div className="relative z-10">
                    <Icon size={iconSize} />
                </div>
                {caption}
            </a>
        );
    }

    if (nav.kind === 'external') {
        const openInNewTab = nav.openInNewTab;
        return (
            <a
                href={nav.url}
                target={openInNewTab ? '_blank' : undefined}
                rel={openInNewTab ? 'noopener noreferrer' : undefined}
                onClick={() => {
                    triggerHaptic();
                    if (!openInNewTab) {
                        onMenuClose();
                    }
                }}
                className="flex flex-col items-center gap-1 transition-colors py-2 px-3 rounded-xl relative text-theme-tertiary active:text-theme-primary"
            >
                <div className="relative z-10">
                    <Icon size={iconSize} />
                </div>
                {caption}
            </a>
        );
    }

    return (
        <span className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl text-theme-tertiary opacity-50">
            <Icon size={iconSize} />
            {caption}
        </span>
    );
}

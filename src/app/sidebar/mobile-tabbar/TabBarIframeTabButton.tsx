import React from 'react';
import type { Tab } from '@/api/endpoints/tabs';
import { triggerHaptic } from '@/utils/haptics';
import logger from '@/utils/logger';

export interface TabBarIframeTabButtonProps {
    tab: Tab;
    hash: string;
    renderIcon: (icon: string | undefined, size: number) => React.ReactNode;
    handleNavigation: (e: React.MouseEvent<HTMLAnchorElement>, dest: string) => void;
    onMenuClose: () => void;
}

export function TabBarIframeTabButton({
    tab,
    hash,
    renderIcon,
    handleNavigation,
    onMenuClose,
}: TabBarIframeTabButtonProps): React.JSX.Element {
    const iconSize = 24;
    const isActive = !tab.openInNewTab && !!tab.slug && hash === tab.slug;
    const caption = (
        <span
            title={tab.name}
            className={`text-[10px] font-medium truncate max-w-[4.5rem] relative z-10 ${isActive ? 'text-accent' : ''}`}
        >
            {tab.name}
        </span>
    );

    if (tab.openInNewTab) {
        return (
            <a
                href={tab.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                    triggerHaptic();
                    onMenuClose();
                }}
                className="flex flex-col items-center gap-1 transition-colors py-2 px-3 rounded-xl relative text-theme-tertiary active:text-theme-primary"
            >
                <div className="relative z-10">{renderIcon(tab.icon, iconSize)}</div>
                {caption}
            </a>
        );
    }

    if (!tab.slug?.trim()) {
        return (
            <span className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl text-theme-tertiary opacity-50">
                {renderIcon(tab.icon, iconSize)}
                {caption}
            </span>
        );
    }

    return (
        <a
            href={`/#${tab.slug}`}
            onClick={(e) => {
                if (!tab.slug?.trim()) {
                    logger.warn('Mobile tab bar iframe tab missing slug', { tabId: tab.id });
                    e.preventDefault();
                    return;
                }
                triggerHaptic();
                handleNavigation(e, `#${tab.slug}`);
                onMenuClose();
            }}
            className="flex flex-col items-center gap-1 transition-colors py-2 px-3 rounded-xl relative text-theme-tertiary active:text-theme-primary"
        >
            <div className={`relative z-10 ${isActive ? 'text-accent' : ''}`}>
                {renderIcon(tab.icon, iconSize)}
            </div>
            {caption}
        </a>
    );
}

import React from 'react';
import { triggerHaptic } from '@/utils/haptics';
import type { TabBarActionDef, TabBarInvokeCtx } from './tabBarActionRegistry';

export interface TabBarActionButtonProps {
    def: TabBarActionDef;
    hash: string;
    currentUser: { profilePicture?: string } | null | undefined;
    unreadCount: number;
    handleNavigation: (e: React.MouseEvent<HTMLAnchorElement>, dest: string) => void;
    onMenuClose: () => void;
    invokeCtx: TabBarInvokeCtx;
}

export function TabBarActionButton({
    def,
    hash,
    currentUser,
    unreadCount,
    handleNavigation,
    onMenuClose,
    invokeCtx,
}: TabBarActionButtonProps): React.JSX.Element {
    const iconSize = 24;

    if (def.kind === 'navigate') {
        const isActive = def.isActive(hash);
        return (
            <a
                href={def.href}
                onClick={e => {
                    triggerHaptic();
                    handleNavigation(e, def.href.replace('/#', '#'));
                    onMenuClose();
                }}
                className="flex flex-col items-center gap-1 transition-colors py-2 px-3 rounded-xl relative text-theme-tertiary active:text-theme-primary"
            >
                <div className={`relative z-10 ${isActive ? 'text-accent' : ''}`}>
                    {def.renderIcon({ size: iconSize, isActive, currentUser, unreadCount })}
                </div>
                <span className={`text-[10px] font-medium relative z-10 ${isActive ? 'text-accent' : ''}`}>
                    {def.label}
                </span>
            </a>
        );
    }

    return (
        <button
            type="button"
            onClick={() => {
                triggerHaptic();
                def.onInvoke(invokeCtx);
            }}
            className="flex flex-col items-center gap-1 transition-colors py-2 px-3 rounded-xl relative text-theme-tertiary active:text-theme-primary"
        >
            <div className="relative z-10">
                {def.renderIcon({ size: iconSize, isActive: false, currentUser, unreadCount })}
            </div>
            <span className="text-[10px] font-medium relative z-10">{def.label}</span>
        </button>
    );
}

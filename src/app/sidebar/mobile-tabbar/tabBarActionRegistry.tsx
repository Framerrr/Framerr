/**
 * Mobile tab bar action registry.
 *
 * To add a new tab-bar action: add a `TabBarActionDef` to `TAB_BAR_ACTIONS`,
 * append its id to `TAB_BAR_ACTION_ORDER` — it becomes assignable in
 * Settings → Customization → Mobile Tab Bar automatically.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Mail, UserCircle } from 'lucide-react';

export interface TabBarActionRenderCtx {
    size: number;
    isActive: boolean;
    currentUser: { profilePicture?: string } | null | undefined;
    unreadCount: number;
}

export interface TabBarInvokeCtx {
    setIsMobileMenuOpen: (open: boolean) => void;
    setShowNotificationCenter: (open: boolean) => void;
}

export type TabBarActionDef = {
    id: string;
    label: string;
    settingsDescription: string;
    renderIcon: (ctx: TabBarActionRenderCtx) => React.ReactNode;
} & (
    | { kind: 'navigate'; href: string; isActive: (hash: string) => boolean }
    | { kind: 'invoke'; onInvoke: (ctx: TabBarInvokeCtx) => void }
);

export const TAB_BAR_ACTIONS: Record<string, TabBarActionDef> = {
    profile: {
        id: 'profile',
        kind: 'navigate',
        label: 'Profile',
        settingsDescription: 'Open your profile settings.',
        href: '/#settings/account/profile',
        isActive: hash =>
            hash === 'settings/account/profile' || hash.startsWith('settings/account/profile?'),
        renderIcon: ({ size, currentUser }) =>
            currentUser?.profilePicture ? (
                <img
                    src={currentUser.profilePicture}
                    alt="Profile"
                    className="rounded-full object-cover border border-slate-600"
                    style={{ width: size, height: size }}
                />
            ) : (
                <UserCircle size={size} />
            ),
    },
    notifications: {
        id: 'notifications',
        kind: 'invoke',
        label: 'Notifications',
        settingsDescription: 'Open the notification center from the menu.',
        onInvoke: ctx => {
            ctx.setShowNotificationCenter(true);
            ctx.setIsMobileMenuOpen(true);
        },
        renderIcon: ({ size, unreadCount }) => (
            <div className="relative">
                <Mail size={size} />
                {unreadCount > 0 && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 bg-error text-white 
                            text-[10px] font-bold rounded-full min-w-[18px] h-[18px] 
                            flex items-center justify-center shadow-lg"
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.div>
                )}
            </div>
        ),
    },
};

export const TAB_BAR_ACTION_ORDER: string[] = ['profile', 'notifications'];

export const TAB_BAR_KNOWN_IDS = new Set(Object.keys(TAB_BAR_ACTIONS));

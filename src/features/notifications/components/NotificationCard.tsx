import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, Check, XCircle, LucideIcon } from 'lucide-react';
import StackedIcons from './StackedIcons';
import { getIconComponent, getIconUrl } from '../../../utils/iconUtils';
import { formatTime } from '../utils/notificationCenter.utils';
import type { NotificationType } from '../types/notificationCenter.types';
import type { Notification } from '../../../../shared/types/notification';

const ICONS: Record<NotificationType, LucideIcon> = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
};

interface NotificationCardContentProps {
    notification: Notification;
    handleRequestAction: (notificationId: string, action: 'approve' | 'decline') => Promise<unknown>;
}

/**
 * NotificationCardContent — renders the full notification card body.
 * Extracted from NotificationCenter's renderNotificationContent callback.
 */
export const NotificationCardContent = ({ notification, handleRequestAction }: NotificationCardContentProps): React.JSX.Element => {
    const Icon = ICONS[notification.type as NotificationType] || Info;

    return (
        <div
            className={`
                px-4 pt-4 pb-6 rounded-xl border border-theme shadow-lg
                ${!notification.read ? 'notification-card bg-theme-primary glass-card bg-accent/5' : 'notification-card bg-theme-primary opacity-70'}
            `}
        >
            <div className="flex items-start gap-3">
                {/* Icon - stacked icons for batched, custom icon, lucide icon, or type-based icon */}
                {notification.iconIds && notification.iconIds.length > 1 ? (
                    <StackedIcons
                        iconIds={notification.iconIds}
                        lucideIcons={(notification.metadata?.lucideIcons as string[] | undefined)}
                        status={notification.type}
                        size={40}
                    />
                ) : notification.iconId ? (
                    <div
                        className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-theme-tertiary/50 flex items-center justify-center shadow-sm"
                        style={{ border: `2px solid var(--${notification.type})` }}
                    >
                        <img
                            src={getIconUrl(notification.iconId) || `/ api / custom - icons / ${notification.iconId}/file`
                            }
                            alt=""
                            className="w-7 h-7 object-contain"
                        />
                    </div >
                ) : (notification.metadata?.lucideIcon as string | undefined) ? (
                    (() => {
                        const LucideIconComponent = getIconComponent(notification.metadata?.lucideIcon as string);
                        return (
                            <div
                                className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm"
                                style={{
                                    backgroundColor: `color-mix(in srgb, var(--${notification.type}) 15%, transparent)`,
                                    border: `2px solid var(--${notification.type})`,
                                    color: `var(--${notification.type})`
                                }}
                            >
                                <LucideIconComponent size={22} />
                            </div>
                        );
                    })()
                ) : (
                    <div
                        className="p-2.5 rounded-xl flex-shrink-0 shadow-sm"
                        style={{
                            backgroundColor: `color-mix(in srgb, var(--${notification.type}) 15%, transparent)`,
                            border: `1px solid color-mix(in srgb, var(--${notification.type}) 20%, transparent)`
                        }}
                    >
                        <Icon
                            size={18}
                            style={{ color: `var(--${notification.type})` }}
                        />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-sm font-semibold leading-tight ${notification.read ? 'text-theme-secondary' : 'text-theme-primary'}`}>
                            {notification.title}
                        </h4>
                        <span className="text-xs text-theme-tertiary whitespace-nowrap font-medium">
                            {formatTime(notification.createdAt)}
                        </span>
                    </div>
                    <p className="text-sm text-theme-secondary mt-1.5 leading-relaxed">
                        {notification.message}
                    </p>
                    {/* Actionable notification buttons - removed from here, moved outside flex */}
                </div>

                {/* Unread indicator */}
                {
                    !notification.read && (
                        <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
                    )
                }
            </div >

            {/* Actionable notification buttons - outside flex row for true centering */}
            {
                notification.metadata?.actionable && notification.metadata?.requestId && (
                    <div className="flex gap-2 mt-3 justify-center">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRequestAction(notification.id, 'approve');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium
                                bg-success/20 text-success hover:bg-success/30 
                                border border-success/20 hover:border-success/40
                                transition-all duration-200 hover:scale-105"
                        >
                            <Check size={14} />
                            Approve
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRequestAction(notification.id, 'decline');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium
                                bg-error/20 text-error hover:bg-error/30 
                                border border-error/20 hover:border-error/40
                                transition-all duration-200 hover:scale-105"
                        >
                            <XCircle size={14} />
                            Decline
                        </button>
                    </div>
                )
            }
        </div >
    );
};


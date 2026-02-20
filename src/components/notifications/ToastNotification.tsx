import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Check, XCircle, LucideIcon } from 'lucide-react';
import StackedIcons from './StackedIcons';
import { getIconComponent, getIconUrl } from '../../utils/iconUtils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

const ICONS: Record<ToastType, LucideIcon> = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
};

interface ToastAction {
    label: string;
    onClick: () => void;
}

interface ToastActionItem {
    label: string;
    onClick: () => void;
    variant?: 'success' | 'danger' | 'default';
}

export interface ToastNotificationProps {
    id: string;
    type?: ToastType;
    title: string;
    message: string;
    iconId?: string | null;
    iconIds?: string[];  // For batched notifications (multiple icons)
    metadata?: Record<string, unknown> | null;  // For lucideIcon support
    duration?: number;
    action?: ToastAction;
    actions?: ToastActionItem[];
    onBodyClick?: () => void;
    onDismiss: (id: string) => void;
    createdAt?: Date | number;  // Date from Toast interface, number also accepted
}

/**
 * ToastNotification Component
 * 
 * Individual toast notification with:
 * - Auto-dismiss with pause-on-hover
 * - Swipe-to-dismiss gestures
 * - Multiple action buttons support (for approve/decline)
 * - Body click to open notification center
 */
const ToastNotification = ({
    id,
    type = 'info',
    title,
    message,
    iconId,
    iconIds,
    metadata,
    duration = 10000,
    action,
    actions,
    onBodyClick,
    onDismiss,
    createdAt
}: ToastNotificationProps): React.JSX.Element => {
    const [progress, setProgress] = useState<number>(100);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const isPausedRef = useRef<boolean>(false);
    const elapsedRef = useRef<number>(0);
    const lastTickRef = useRef<number>(Date.now());
    const rafRef = useRef<number | null>(null);
    const controls = useAnimation();

    const Icon = ICONS[type] || Info;

    // Animation loop using requestAnimationFrame
    // Note: duration === 0 means persistent (no auto-dismiss)
    const tick = useCallback((): void => {
        if (duration === 0 || duration === undefined) return;

        const now = Date.now();

        if (!isPausedRef.current) {
            // Calculate time since last tick
            const delta = now - lastTickRef.current;
            elapsedRef.current += delta;

            // Calculate remaining progress
            const remaining = Math.max(0, 100 - (elapsedRef.current / duration) * 100);
            setProgress(remaining);

            // Check if complete
            if (remaining <= 0) {
                onDismiss(id);
                return;
            }
        }

        lastTickRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
    }, [id, duration, onDismiss]);

    // Start animation on mount - skip for persistent toasts (duration: 0)
    useEffect(() => {
        if (duration === 0 || duration === undefined) return;

        lastTickRef.current = Date.now();
        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [duration, tick]);

    // Reset timer when createdAt changes (timer reset from push notification click)
    useEffect(() => {
        if (createdAt) {
            elapsedRef.current = 0;
            lastTickRef.current = Date.now();
            setProgress(100);
        }
    }, [createdAt]);

    const handleMouseEnter = (): void => {
        isPausedRef.current = true;
    };

    const handleMouseLeave = (): void => {
        // Reset lastTick to now so we don't count pause time
        lastTickRef.current = Date.now();
        isPausedRef.current = false;
    };

    // Trigger initial animation on mount
    useEffect(() => {
        controls.start({ opacity: 1, y: 0, scale: 1, x: 0 });
    }, [controls]);

    // Handle swipe dismiss
    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void => {
        setIsDragging(false);
        const threshold = 100;

        if (Math.abs(info.offset.x) > threshold) {
            // Animate out in swipe direction
            controls.start({
                x: info.offset.x > 0 ? 400 : -400,
                opacity: 0,
                transition: { duration: 0.2 }
            }).then(() => {
                onDismiss(id);
            });
        } else {
            // Snap back
            controls.start({ x: 0, opacity: 1 });
        }
    };

    // Handle body click (open notification center)
    const handleBodyClick = (e: React.MouseEvent<HTMLDivElement>): void => {
        // Don't trigger if clicking buttons or during drag
        if (isDragging) return;
        if ((e.target as HTMLElement).closest('button')) return;

        if (onBodyClick) {
            onBodyClick();
            onDismiss(id); // Also dismiss the toast
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95, x: 0 }}
            animate={controls}
            exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
            transition={{
                type: 'spring',
                stiffness: 350,
                damping: 35
            }}
            drag="x"
            dragElastic={0.8}
            dragSnapToOrigin={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            className={`notification-card glass-card bg-theme-primary border border-theme rounded-xl shadow-lg
        max-w-sm w-full overflow-hidden ${onBodyClick ? 'cursor-pointer' : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleBodyClick}
            role="alert"
            aria-live="assertive"
            style={{ touchAction: 'pan-y' }}
        >
            <div className={`flex gap-3 p-4 ${message && message.trim() ? 'items-start' : 'items-center'}`}>
                {/* Icon - stacked icons for batched, Lucide icon, custom icon, or type-based icon */}
                {(iconIds && iconIds.length > 1) || (metadata?.lucideIcons as string[] | undefined)?.length ? (
                    <StackedIcons
                        iconIds={iconIds || []}
                        lucideIcons={(metadata?.lucideIcons as string[] | undefined)}
                        status={type}
                        size={40}
                    />
                ) : (metadata?.lucideIcon as string | undefined) ? (
                    (() => {
                        const LucideIconComponent = getIconComponent(metadata?.lucideIcon as string);
                        return (
                            <div
                                className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
                                style={{
                                    backgroundColor: `color-mix(in srgb, var(--${type}) 15%, transparent)`,
                                    border: `2px solid var(--${type})`,
                                    color: `var(--${type})`
                                }}
                            >
                                <LucideIconComponent size={22} />
                            </div>
                        );
                    })()
                ) : iconId ? (
                    <div
                        className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-theme-tertiary flex items-center justify-center"
                        style={{ border: `2px solid var(--${type})` }}
                    >
                        <img
                            src={getIconUrl(iconId) || `/api/custom-icons/${iconId}/file`}
                            alt=""
                            className="w-8 h-8 object-contain"
                        />
                    </div>
                ) : (
                    <div
                        className="p-2 rounded-lg flex-shrink-0"
                        style={{
                            backgroundColor: `var(--${type})`,
                            opacity: 0.2
                        }}
                    >
                        <Icon
                            size={20}
                            style={{ color: `var(--${type})` }}
                            aria-hidden="true"
                        />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-theme-primary font-semibold text-sm">
                        {title}
                    </h4>
                    {/* Only show message paragraph if there's actual content */}
                    {message && message.trim() && (
                        <p className="text-theme-secondary text-sm mt-1">
                            {message}
                        </p>
                    )}

                    {/* Single action button (legacy support) */}
                    {action && !actions && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                action.onClick();
                                onDismiss(id);
                            }}
                            className="text-accent hover:text-accent-hover 
                text-sm font-medium mt-2 transition-colors"
                        >
                            {action.label}
                        </button>
                    )}

                    {/* Multiple action buttons (approve/decline) */}
                    {actions && actions.length > 0 && (
                        <div className="flex gap-2 mt-3">
                            {actions.map((actionItem, index) => (
                                <button
                                    key={index}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        actionItem.onClick();
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${actionItem.variant === 'success'
                                        ? 'bg-success/20 text-success hover:bg-success/30'
                                        : actionItem.variant === 'danger'
                                            ? 'bg-error/20 text-error hover:bg-error/30'
                                            : 'bg-accent/20 text-accent hover:bg-accent/30'
                                        }`}
                                >
                                    {actionItem.variant === 'success' && <Check size={14} />}
                                    {actionItem.variant === 'danger' && <XCircle size={14} />}
                                    {actionItem.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Close button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(id);
                    }}
                    className="text-theme-tertiary hover:text-theme-primary 
            transition-colors flex-shrink-0 p-1"
                    aria-label="Dismiss notification"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Progress bar - smooth animation via requestAnimationFrame */}
            {/* duration > 0 means timed toast; duration === 0 means persistent (no bar) */}
            {duration !== undefined && duration > 0 && (
                <div
                    className="h-1"
                    style={{
                        width: `${progress}%`,
                        background: `linear-gradient(
              to right, 
              var(--${type}), 
              var(--${type}-hover, var(--${type}))
            )`
                    }}
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                />
            )}
        </motion.div>
    );
};

export default ToastNotification;

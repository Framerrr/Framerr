import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { ChevronUp, X, Check, Trash2 } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import type { Notification } from '../../../shared/types/notification';

type NotificationSource = 'overseerr' | 'sonarr' | 'radarr' | 'system';

interface NotificationGroupProps {
    source: NotificationSource;
    notifications: Notification[];
    renderNotification: (notification: Notification, index: number) => React.ReactNode;
    renderNotificationContent: (notification: Notification) => React.ReactNode;
    renderCollapsedNotification: (notification: Notification, count: number) => React.ReactNode;
    onClearGroup: (source: NotificationSource) => void;
    onMarkAllAsRead: (source: NotificationSource) => void;
}

// Swipe thresholds (iOS-style)
const REVEAL_THRESHOLD = 25;   // Start showing action button (more lenient)
const SNAP_THRESHOLD = 90;     // If released here, snap to show full button (matches BUTTON_WIDTH)
const COMMIT_THRESHOLD = 180;  // If swiped this far, execute action immediately (harder)
const BUTTON_WIDTH = 90;       // Width to snap to when showing button (80px button + padding)

// Source display names and colors
const SOURCE_CONFIG: Record<NotificationSource, { label: string; color: string }> = {
    overseerr: { label: 'Overseerr', color: 'var(--accent)' },
    sonarr: { label: 'Sonarr', color: '#3fc1c9' },
    radarr: { label: 'Radarr', color: '#ffc230' },
    system: { label: 'System', color: 'var(--text-secondary)' }
};

/**
 * SwipeableStack - Swipeable wrapper for collapsed notification stacks
 * iOS-style behavior:
 * - Swipe past SNAP_THRESHOLD: snaps to show action button (user can tap)
 * - Swipe past COMMIT_THRESHOLD: executes action immediately
 * - Swipe right: Mark all as read
 * - Swipe left: Clear all
 */
interface SwipeableStackProps {
    children: React.ReactNode;
    onMarkAllAsRead: () => void;
    onClearAll: () => void;
    hasUnread: boolean;
    onTap: () => void;
    marginBottom: string;
    enabled: boolean; // When false, drag is disabled and events pass through to children
}

const SwipeableStack = ({
    children,
    onMarkAllAsRead,
    onClearAll,
    hasUnread,
    onTap,
    marginBottom,
    enabled
}: SwipeableStackProps): React.JSX.Element => {
    const x = useMotionValue(0);
    const [isSnapped, setIsSnapped] = useState<'left' | 'right' | null>(null);
    const [hasDragged, setHasDragged] = useState(false);

    // Transform x position to opacity for action buttons
    const leftActionOpacity = useTransform(x, [-COMMIT_THRESHOLD, -SNAP_THRESHOLD, -REVEAL_THRESHOLD, 0], [1, 1, 0.8, 0]);
    const rightActionOpacity = useTransform(x, [0, REVEAL_THRESHOLD, SNAP_THRESHOLD, COMMIT_THRESHOLD], [0, 0.8, 1, 1]);

    // Scale for action icons
    const leftActionScale = useTransform(x, [-COMMIT_THRESHOLD, -SNAP_THRESHOLD, 0], [1.2, 1, 0.8]);
    const rightActionScale = useTransform(x, [0, SNAP_THRESHOLD, COMMIT_THRESHOLD], [0.8, 1, 1.2]);

    const handleDragEnd = useCallback((_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const velocity = info.velocity.x;
        const offset = info.offset.x;  // How far user actually swiped this gesture
        const currentX = x.get();

        // iOS-like thresholds combining velocity and distance
        const VELOCITY_COMMIT = 800;   // Fast swipe threshold (increased)
        const VELOCITY_ASSIST = 300;   // Velocity that assists distance-based decisions (increased)

        // Right direction (mark all as read)
        if (velocity > 0 || currentX > 0 || offset > 0) {
            if (!hasUnread) {
                animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
                setIsSnapped(null);
                return;
            }

            // Commit conditions
            const shouldCommit =
                velocity > VELOCITY_COMMIT ||
                currentX >= COMMIT_THRESHOLD ||
                offset >= COMMIT_THRESHOLD ||
                (velocity > VELOCITY_ASSIST && offset > SNAP_THRESHOLD) ||
                (velocity > 100 && currentX > SNAP_THRESHOLD && offset > SNAP_THRESHOLD * 0.7);

            if (shouldCommit) {
                animate(x, COMMIT_THRESHOLD + 20, {
                    type: 'spring', stiffness: 800, damping: 35,
                    onComplete: () => {
                        onMarkAllAsRead();
                        animate(x, 0, { type: 'spring', stiffness: 600, damping: 30 });
                        setIsSnapped(null);
                    }
                });
                return;
            }

            // Snap to button conditions
            const shouldSnap =
                currentX > SNAP_THRESHOLD * 0.6 ||
                (offset > SNAP_THRESHOLD * 0.5 && velocity > 50) ||
                (velocity > 100 && offset > 30);

            if (shouldSnap) {
                animate(x, BUTTON_WIDTH, { type: 'spring', stiffness: 500, damping: 30 });
                setIsSnapped('right');
                return;
            }

            // Return to center
            animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
            setIsSnapped(null);
            return;
        }

        // Left direction (clear all)
        if (velocity < 0 || currentX < 0 || offset < 0) {
            const shouldCommit =
                velocity < -VELOCITY_COMMIT ||
                currentX <= -COMMIT_THRESHOLD ||
                offset <= -COMMIT_THRESHOLD ||
                (velocity < -VELOCITY_ASSIST && offset < -SNAP_THRESHOLD) ||
                (velocity < -100 && currentX < -SNAP_THRESHOLD && offset < -SNAP_THRESHOLD * 0.7);

            if (shouldCommit) {
                animate(x, -400, {
                    type: 'spring', stiffness: 400, damping: 30,
                    onComplete: () => { onClearAll(); }
                });
                setIsSnapped(null);
                return;
            }

            const shouldSnap =
                currentX < -SNAP_THRESHOLD * 0.6 ||
                (offset < -SNAP_THRESHOLD * 0.5 && velocity < -50) ||
                (velocity < -100 && offset < -30);

            if (shouldSnap) {
                animate(x, -BUTTON_WIDTH, { type: 'spring', stiffness: 500, damping: 30 });
                setIsSnapped('left');
                return;
            }

            animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
            setIsSnapped(null);
            return;
        }

        // No movement - stay where appropriate
        if (isSnapped === 'right') {
            animate(x, BUTTON_WIDTH, { type: 'spring', stiffness: 500, damping: 30 });
        } else if (isSnapped === 'left') {
            animate(x, -BUTTON_WIDTH, { type: 'spring', stiffness: 500, damping: 30 });
        } else {
            animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
        }
    }, [x, onMarkAllAsRead, onClearAll, hasUnread, isSnapped]);

    // Handle action button clicks when snapped
    const handleRightActionClick = useCallback(() => {
        if (isSnapped === 'right' && hasUnread) {
            triggerHaptic('light');
            onMarkAllAsRead();
            animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
            setIsSnapped(null);
        }
    }, [isSnapped, hasUnread, onMarkAllAsRead, x]);

    const handleLeftActionClick = useCallback(() => {
        if (isSnapped === 'left') {
            triggerHaptic('light');
            onClearAll();
        }
    }, [isSnapped, onClearAll]);

    // Reset snapped state on expand/collapse event
    useEffect(() => {
        const handleReset = () => {
            if (isSnapped) {
                animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
                setIsSnapped(null);
            }
        };

        window.addEventListener('reset-swipe', handleReset);
        return () => window.removeEventListener('reset-swipe', handleReset);
    }, [isSnapped, x]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative"
            style={{ marginBottom }}
        >
            {/* Swipe action layer - positioned to match the visible card area */}
            <div className="absolute inset-0 overflow-hidden rounded-xl" style={{ marginLeft: '16px', marginRight: '16px', marginBottom: '12px' }}>
                {/* Left action - Clear All (revealed when swiping left) */}
                <motion.div
                    className="absolute inset-y-2 right-2 flex items-center justify-center rounded-xl bg-error cursor-pointer"
                    style={{
                        opacity: leftActionOpacity,
                        width: 80
                    }}
                    onClick={handleLeftActionClick}
                >
                    <motion.div
                        className="flex flex-col items-center gap-1 text-white"
                        style={{ scale: leftActionScale }}
                    >
                        <Trash2 size={20} />
                        <span className="text-xs font-medium">Clear All</span>
                    </motion.div>
                </motion.div>

                {/* Right action - Read All (revealed when swiping right) */}
                {hasUnread && (
                    <motion.div
                        className="absolute inset-y-2 left-2 flex items-center justify-center rounded-xl bg-success cursor-pointer"
                        style={{
                            opacity: rightActionOpacity,
                            width: 80
                        }}
                        onClick={handleRightActionClick}
                    >
                        <motion.div
                            className="flex flex-col items-center gap-1 text-white"
                            style={{ scale: rightActionScale }}
                        >
                            <Check size={20} />
                            <span className="text-xs font-medium">Read All</span>
                        </motion.div>
                    </motion.div>
                )}
            </div>

            {/* Draggable stack - allows stacked cards to overflow */}
            {/* When enabled=false, drag is disabled and inner SwipeableNotification receives gestures */}
            <motion.div
                data-draggable="true"
                style={{ x: enabled ? x : 0, touchAction: 'none' }}
                drag={enabled ? "x" : false}
                dragDirectionLock
                dragElastic={0.1}
                dragConstraints={{ left: -150, right: hasUnread ? 150 : 0 }}
                onDragStart={() => enabled && setHasDragged(true)}
                onDragEnd={(e, info) => {
                    if (!enabled) return;
                    handleDragEnd(e, info);
                    setTimeout(() => setHasDragged(false), 100);
                }}
                onClick={() => {
                    // Only trigger tap if enabled, no drag happened, and not snapped
                    if (enabled && !hasDragged && Math.abs(x.get()) < 5 && !isSnapped) {
                        onTap();
                    }
                }}
                className={`relative ${enabled ? 'cursor-pointer' : ''}`}
            >
                {children}
            </motion.div>
        </motion.div>
    );
};

/**
 * NotificationGroup - iOS-style collapsible notification stack
 * 
 * - Stacked card visual when collapsed (shows peek of cards below)
 * - Smooth expand/collapse animation
 * - "Show less" button when expanded
 * - X → "Clear" button to clear all in group
 */
const NotificationGroup = ({
    source,
    notifications,
    renderNotification,
    renderNotificationContent,
    renderCollapsedNotification,
    onClearGroup,
    onMarkAllAsRead
}: NotificationGroupProps): React.JSX.Element | null => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    if (notifications.length === 0) return null;

    const config = SOURCE_CONFIG[source];
    const hasMultiple = notifications.length > 1;
    const unreadCount = notifications.filter(n => !n.read).length;

    const handleClearGroup = () => {
        onClearGroup(source);
        setShowClearConfirm(false);
    };

    // Reset swipe state when collapsed
    useEffect(() => {
        if (!isExpanded) {
            setShowClearConfirm(false);
            // Dispatch event to reset all swiped notifications (including the stack itself)
            window.dispatchEvent(new CustomEvent('reset-swipe'));
        }
    }, [isExpanded]);

    return (
        <div className="mb-6">
            {/* Group Header */}
            <div className="mx-4 mb-2 flex items-center justify-between">
                <button
                    onClick={() => {
                        if (hasMultiple) {
                            // Dispatch event to reset all swiped notifications BEFORE expanding
                            if (!isExpanded) {
                                window.dispatchEvent(new CustomEvent('reset-swipe'));
                            }
                            setIsExpanded(!isExpanded);
                        }
                    }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${hasMultiple ? 'hover:bg-theme-hover cursor-pointer' : 'cursor-default'
                        }`}
                >
                    {/* Source indicator dot */}
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: config.color }}
                    />
                    <span className="text-sm font-semibold text-theme-primary">
                        {config.label}
                    </span>
                    <span className="text-xs text-theme-tertiary">
                        ({notifications.length})
                    </span>
                    {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-accent text-white rounded-full">
                            {unreadCount} new
                        </span>
                    )}
                    {hasMultiple && (
                        <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronUp size={14} className="text-theme-tertiary" />
                        </motion.div>
                    )}
                </button>

                {/* Controls when expanded */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="flex items-center gap-2"
                        >
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="text-xs text-theme-secondary hover:text-theme-primary transition-colors"
                            >
                                Show less
                            </button>
                            {!showClearConfirm ? (
                                <button
                                    onClick={() => setShowClearConfirm(true)}
                                    className="p-1.5 rounded-lg text-theme-tertiary hover:text-error hover:bg-error/10 transition-colors"
                                    title="Clear all"
                                >
                                    <X size={14} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleClearGroup}
                                    className="px-2 py-1 text-xs font-medium text-error bg-error/10 hover:bg-error/20 rounded-lg transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Notification Stack - True iOS-style persistent element animation */}
            {/* SwipeableStack ALWAYS wraps - enabled toggles whether it intercepts swipes */}
            <SwipeableStack
                onMarkAllAsRead={() => onMarkAllAsRead(source)}
                onClearAll={() => onClearGroup(source)}
                hasUnread={unreadCount > 0}
                onTap={() => !isExpanded && setIsExpanded(true)}
                marginBottom={!isExpanded && hasMultiple ? (notifications.length > 2 ? '30px' : '15px') : '0'}
                enabled={!isExpanded && hasMultiple}
            >
                {/* Stacked card shadows - animate opacity, not conditional render */}
                {/* Both shadows have consistent 6px vertical offset from each other */}
                {hasMultiple && (
                    <>
                        {notifications.length > 2 && (
                            <motion.div
                                animate={{ opacity: isExpanded ? 0 : 0.5 }}
                                transition={{ duration: 0.2 }}
                                className="absolute left-10 right-10 rounded-xl border border-theme bg-theme-secondary pointer-events-none"
                                style={{
                                    top: '0px',
                                    bottom: '-14px',
                                    zIndex: 1
                                }}
                            />
                        )}
                        <motion.div
                            animate={{ opacity: isExpanded ? 0 : 0.7 }}
                            transition={{ duration: 0.2 }}
                            className="absolute left-7 right-7 rounded-xl border border-theme bg-theme-secondary pointer-events-none"
                            style={{
                                top: '6px',
                                bottom: '-1px',
                                zIndex: 2
                            }}
                        />
                    </>
                )}

                {/* First notification - ALWAYS rendered via renderNotification (has its own SwipeableNotification) */}
                {/* pointerEvents: 'none' when collapsed so SwipeableStack receives gestures instead */}
                {/* z-10 only when collapsed to appear above shadows */}
                <div
                    className={`relative ${!isExpanded && hasMultiple ? 'z-10' : ''}`}
                    style={{ pointerEvents: !isExpanded && hasMultiple ? 'none' : 'auto' }}
                >
                    {renderNotification(notifications[0], 0)}
                </div>

                {/* Tap to expand hint - animate height in/out with spring for smoothness */}
                <AnimatePresence>
                    {!isExpanded && hasMultiple && (
                        <motion.div
                            key="tap-hint"
                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                            animate={{ height: 'auto', opacity: 1, marginTop: -28 }}
                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                            transition={{
                                duration: 0.1,
                                ease: [0.32, 0.72, 0, 1]
                            }}
                            className="overflow-hidden"
                        >
                            <div className="mx-4 mb-3 relative z-20">
                                <div
                                    className="flex items-center justify-center py-2.5 px-4 rounded-b-xl bg-theme-secondary border border-t-0 border-theme hover:bg-theme-hover transition-colors cursor-pointer"
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('reset-swipe'));
                                        setIsExpanded(true);
                                    }}
                                >
                                    <span className="text-xs text-theme-secondary font-medium">
                                        Tap to expand · {notifications.length} notifications
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </SwipeableStack>

            {/* Additional notifications - expand from underneath */}
            <AnimatePresence>
                {isExpanded && notifications.slice(1).map((notification, i) => (
                    <motion.div
                        key={notification.id}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{
                            height: 'auto',
                            opacity: 1,
                            transition: {
                                delay: i * 0.04,
                                type: 'spring',
                                stiffness: 300,
                                damping: 25,
                                mass: 0.8
                            }
                        }}
                        exit={{
                            height: 0,
                            opacity: 0,
                            marginBottom: 0,
                            transition: {
                                type: 'spring',
                                stiffness: 400,
                                damping: 30,
                                mass: 0.6
                            }
                        }}
                        style={{ overflow: 'hidden' }}
                        className="mb-0"
                    >
                        {renderNotification(notification, i + 1)}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default NotificationGroup;

import React, { useState, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';
import { triggerHaptic } from '../../../utils/haptics';
import { REVEAL_THRESHOLD, SNAP_THRESHOLD, COMMIT_THRESHOLD, BUTTON_WIDTH } from '../utils/notificationCenter.utils';

/**
 * SwipeableStack - Swipeable wrapper for collapsed notification stacks
 * iOS-style behavior:
 * - Swipe past SNAP_THRESHOLD: snaps to show action button (user can tap)
 * - Swipe past COMMIT_THRESHOLD: executes action immediately
 * - Swipe right: Mark all as read
 * - Swipe left: Clear all
 */
export interface SwipeableStackProps {
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

export default SwipeableStack;

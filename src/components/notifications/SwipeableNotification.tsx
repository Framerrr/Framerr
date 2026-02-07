import React, { useCallback, useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

interface SwipeableNotificationProps {
    children: React.ReactNode;
    onMarkAsRead?: () => void;
    onDelete: () => void;
    isRead?: boolean;
}

// Thresholds for swipe actions (matched to SwipeableStack)
const REVEAL_THRESHOLD = 25;   // Start showing action button (more lenient)
const SNAP_THRESHOLD = 90;     // If released here, snap to show full button (matches BUTTON_WIDTH)
const COMMIT_THRESHOLD = 180;  // If swiped this far, execute action immediately (harder)
const BUTTON_WIDTH = 90;       // Width to snap to when showing button (80px button + padding)

/**
 * SwipeableNotification - iOS-style swipe gestures for notifications
 * 
 * - Swipe right: Mark as read (green)
 * - Swipe left: Delete (red)
 * - Card follows finger position
 * - Two thresholds: reveal action vs execute action
 * - Matches SwipeableStack design
 */
const SwipeableNotification = ({
    children,
    onMarkAsRead,
    onDelete,
    isRead = false
}: SwipeableNotificationProps): React.JSX.Element => {
    const x = useMotionValue(0);
    const [isSnapped, setIsSnapped] = useState<'left' | 'right' | null>(null);

    // Transform x position to opacity for action buttons
    const leftActionOpacity = useTransform(x, [-COMMIT_THRESHOLD, -REVEAL_THRESHOLD, 0], [1, 0.8, 0]);
    const rightActionOpacity = useTransform(x, [0, REVEAL_THRESHOLD, COMMIT_THRESHOLD], [0, 0.8, 1]);

    // Scale for action icons
    const leftActionScale = useTransform(x, [-COMMIT_THRESHOLD, -REVEAL_THRESHOLD, 0], [1.2, 1, 0.8]);
    const rightActionScale = useTransform(x, [0, REVEAL_THRESHOLD, COMMIT_THRESHOLD], [0.8, 1, 1.2]);

    const handleDragEnd = useCallback((_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const velocity = info.velocity.x;
        const offset = info.offset.x;  // How far user actually swiped this gesture
        const currentX = x.get();

        // iOS-like thresholds combining velocity and distance
        const VELOCITY_COMMIT = 800;   // Fast swipe threshold (increased)
        const VELOCITY_ASSIST = 300;   // Velocity that assists distance-based decisions (increased)

        // Right direction (mark as read)
        if (velocity > 0 || currentX > 0 || offset > 0) {
            if (!onMarkAsRead || isRead) {
                animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
                setIsSnapped(null);
                return;
            }

            // Commit conditions (any of these):
            // 1. Fast swipe regardless of distance
            // 2. Current position past commit threshold
            // 3. Swiped far enough (offset > commit threshold)
            // 4. Moderate velocity + good distance (offset > snap threshold)
            // 5. Any velocity + position past snap + good swipe distance
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
                        onMarkAsRead();
                        animate(x, 0, { type: 'spring', stiffness: 600, damping: 30 });
                    }
                });
                setIsSnapped(null);
                return;
            }

            // Snap to button conditions:
            // 1. Position past ~60% of snap threshold
            // 2. Swiped more than half snap threshold with some velocity
            // 3. Low velocity but decent offset
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

        // Left direction (delete)
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
                    onComplete: () => { onDelete(); }
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
    }, [x, onMarkAsRead, onDelete, isRead, isSnapped]);

    // Handle action button clicks when snapped
    const handleRightActionClick = useCallback(() => {
        if (isSnapped === 'right' && onMarkAsRead && !isRead) {
            triggerHaptic('light');
            onMarkAsRead();
            animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
            setIsSnapped(null);
        }
    }, [isSnapped, isRead, onMarkAsRead, x]);

    const handleLeftActionClick = useCallback(() => {
        if (isSnapped === 'left') {
            triggerHaptic('light');
            onDelete();
        }
    }, [isSnapped, onDelete]);

    // Reset snapped state on scroll - iOS pattern
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!isSnapped) return undefined;

        const handleScroll = () => {
            if (isSnapped) {
                animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
                setIsSnapped(null);
            }
        };

        // Find the scrollable parent
        const scrollContainer = containerRef.current?.closest('.overflow-y-auto');
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
            return () => scrollContainer.removeEventListener('scroll', handleScroll);
        }
        return undefined;
    }, [isSnapped, x]);

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
        <div ref={containerRef} className="relative">
            {/* Action buttons container - no overflow hidden so card goes off screen */}
            <div className="absolute inset-0 overflow-hidden rounded-xl">
                {/* Left action - Delete (revealed when swiping left) */}
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
                        <span className="text-xs font-medium">Delete</span>
                    </motion.div>
                </motion.div>

                {/* Right action - Mark as Read (revealed when swiping right) */}
                {!isRead && onMarkAsRead && (
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
                            <span className="text-xs font-medium">Read</span>
                        </motion.div>
                    </motion.div>
                )}
            </div>

            {/* Draggable notification card - can go off screen */}
            <motion.div
                data-draggable="true"
                style={{ x, touchAction: 'none' }}
                drag="x"
                dragDirectionLock
                dragElastic={0.1}
                dragConstraints={{ left: -150, right: isRead || !onMarkAsRead ? 0 : 150 }}
                onDragEnd={handleDragEnd}
                className="relative bg-theme-primary rounded-xl cursor-grab active:cursor-grabbing overflow-hidden"
            >
                {children}
            </motion.div>
        </div>
    );
};

export default SwipeableNotification;

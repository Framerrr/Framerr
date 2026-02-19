import React, { useCallback, useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { Check, Trash2 } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

interface SwipeableNotificationProps {
    children: React.ReactNode;
    onMarkAsRead?: () => void;
    onDelete: () => void;
    isRead?: boolean;
}

// Thresholds for swipe actions
const REVEAL_THRESHOLD = 30;   // Start showing action button
const SNAP_THRESHOLD = 90;     // If released here, snap to show full button (matches BUTTON_WIDTH)
const COMMIT_THRESHOLD = 200;  // Full commit — execute action (requires intentional swipe)
const BUTTON_WIDTH = 90;       // Width to snap to when showing button (80px button + padding)

// Velocity thresholds (px/ms for @use-gesture)
const VELOCITY_COMMIT = 1.0;   // Very fast swipe for instant commit
const VELOCITY_ASSIST = 0.5;   // Moderate velocity that assists distance-based decisions

// Drag constraints
const MAX_LEFT = -180;
const MAX_RIGHT_DEFAULT = 180;

/**
 * SwipeableNotification - iOS-style swipe gestures for notifications
 * 
 * - Swipe right: Mark as read (green)
 * - Swipe left: Delete (red)
 * - Card follows finger position
 * - Two thresholds: reveal action vs execute action
 * - When snapped, swiping back returns to center (no crossover to opposite action)
 * 
 * Uses @use-gesture/react for gesture detection, Framer Motion for animations.
 */
const SwipeableNotification = ({
    children,
    onMarkAsRead,
    onDelete,
    isRead = false
}: SwipeableNotificationProps): React.JSX.Element => {
    const x = useMotionValue(0);
    const [isSnapped, setIsSnapped] = useState<'left' | 'right' | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const maxRight = (isRead || !onMarkAsRead) ? 0 : MAX_RIGHT_DEFAULT;

    // Transform x position to opacity for action buttons
    const leftActionOpacity = useTransform(x, [-COMMIT_THRESHOLD, -REVEAL_THRESHOLD, 0], [1, 0.8, 0]);
    const rightActionOpacity = useTransform(x, [0, REVEAL_THRESHOLD, COMMIT_THRESHOLD], [0, 0.8, 1]);

    // Scale for action icons
    const leftActionScale = useTransform(x, [-COMMIT_THRESHOLD, -REVEAL_THRESHOLD, 0], [1.2, 1, 0.8]);
    const rightActionScale = useTransform(x, [0, REVEAL_THRESHOLD, COMMIT_THRESHOLD], [0.8, 1, 1.2]);

    // Spring config used throughout
    const springConfig = { type: 'spring' as const, stiffness: 500, damping: 30 };

    const handleRelease = useCallback((velocity: number) => {
        const currentX = x.get();

        // =====================================================================
        // CROSSOVER PREVENTION: When snapped, swiping back always returns to 0.
        // =====================================================================
        if (isSnapped === 'right') {
            if (velocity < 0 || currentX < BUTTON_WIDTH * 0.5) {
                // Swiping back toward center
                animate(x, 0, springConfig);
                setIsSnapped(null);
                return;
            }
            // Swiping further right from snapped — check for commit
            if (currentX >= COMMIT_THRESHOLD || velocity > VELOCITY_COMMIT ||
                (velocity > VELOCITY_ASSIST && currentX > SNAP_THRESHOLD * 1.2)) {
                if (onMarkAsRead && !isRead) {
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
            }
            // Stay snapped
            animate(x, BUTTON_WIDTH, springConfig);
            return;
        }

        if (isSnapped === 'left') {
            if (velocity > 0 || currentX > -BUTTON_WIDTH * 0.5) {
                animate(x, 0, springConfig);
                setIsSnapped(null);
                return;
            }
            // Swiping further left from snapped — check for commit
            if (currentX <= -COMMIT_THRESHOLD || velocity < -VELOCITY_COMMIT ||
                (velocity < -VELOCITY_ASSIST && currentX < -SNAP_THRESHOLD * 1.2)) {
                animate(x, -400, {
                    type: 'spring', stiffness: 400, damping: 30,
                    onComplete: () => { onDelete(); }
                });
                setIsSnapped(null);
                return;
            }
            // Stay snapped
            animate(x, -BUTTON_WIDTH, springConfig);
            return;
        }

        // =====================================================================
        // NOT SNAPPED: Fresh swipe from center position.
        // =====================================================================
        const DEAD_ZONE = 20;

        if (Math.abs(currentX) < DEAD_ZONE) {
            animate(x, 0, springConfig);
            return;
        }

        // Right direction (mark as read)
        if (currentX > 0) {
            if (!onMarkAsRead || isRead) {
                animate(x, 0, springConfig);
                return;
            }

            const shouldCommit =
                (velocity > VELOCITY_COMMIT && currentX > SNAP_THRESHOLD * 0.5) ||
                currentX >= COMMIT_THRESHOLD ||
                (velocity > VELOCITY_ASSIST && currentX > SNAP_THRESHOLD);

            if (shouldCommit) {
                animate(x, COMMIT_THRESHOLD + 20, {
                    type: 'spring', stiffness: 800, damping: 35,
                    onComplete: () => {
                        onMarkAsRead();
                        animate(x, 0, { type: 'spring', stiffness: 600, damping: 30 });
                    }
                });
                return;
            }

            const shouldSnap =
                currentX > SNAP_THRESHOLD * 0.8 ||
                (currentX > SNAP_THRESHOLD * 0.6 && velocity > 0.1);

            if (shouldSnap) {
                animate(x, BUTTON_WIDTH, springConfig);
                setIsSnapped('right');
                return;
            }

            animate(x, 0, springConfig);
            return;
        }

        // Left direction (delete)
        if (currentX < 0) {
            const shouldCommit =
                (velocity < -VELOCITY_COMMIT && currentX < -SNAP_THRESHOLD * 0.5) ||
                currentX <= -COMMIT_THRESHOLD ||
                (velocity < -VELOCITY_ASSIST && currentX < -SNAP_THRESHOLD);

            if (shouldCommit) {
                animate(x, -400, {
                    type: 'spring', stiffness: 400, damping: 30,
                    onComplete: () => { onDelete(); }
                });
                return;
            }

            const shouldSnap =
                currentX < -SNAP_THRESHOLD * 0.8 ||
                (currentX < -SNAP_THRESHOLD * 0.6 && velocity < -0.1);

            if (shouldSnap) {
                animate(x, -BUTTON_WIDTH, springConfig);
                setIsSnapped('left');
                return;
            }

            animate(x, 0, springConfig);
            return;
        }

        animate(x, 0, springConfig);
    }, [x, onMarkAsRead, onDelete, isRead, isSnapped]);

    // @use-gesture drag handler — replaces Framer Motion drag + manual direction detection
    useDrag(
        ({ down, movement: [mx], velocity: [vx], direction: [dx], event, cancel, tap }) => {
            if (tap) return;

            // Stop the event from reaching the pull-to-close gesture handler
            event.stopPropagation();

            if (down) {
                // Clamp within constraints with elastic overshoot
                const elastic = 0.15;
                let newX = mx;
                if (newX < MAX_LEFT) {
                    newX = MAX_LEFT + (newX - MAX_LEFT) * elastic;
                } else if (newX > maxRight) {
                    newX = maxRight + (newX - maxRight) * elastic;
                }
                x.set(newX);
            } else {
                // Released — pass velocity (direction-aware) to threshold logic
                handleRelease(vx * dx);
            }
        },
        {
            target: cardRef,
            axis: 'lock',        // Auto-detect horizontal vs vertical, lock to one
            filterTaps: true,
            threshold: [8, 8],   // 8px dead zone matches original direction detection
            eventOptions: { passive: true },
            from: () => [x.get(), 0],  // Start from current position (important for snapped state)
        }
    );

    // Handle action button clicks when snapped
    const handleRightActionClick = useCallback(() => {
        if (isSnapped === 'right' && onMarkAsRead && !isRead) {
            triggerHaptic('light');
            onMarkAsRead();
            animate(x, 0, springConfig);
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
                animate(x, 0, springConfig);
                setIsSnapped(null);
            }
        };

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
                animate(x, 0, springConfig);
                setIsSnapped(null);
            }
        };

        window.addEventListener('reset-swipe', handleReset);
        return () => window.removeEventListener('reset-swipe', handleReset);
    }, [isSnapped, x]);

    return (
        <div ref={containerRef} className="relative">
            {/* Action buttons container */}
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

            {/* Notification card — @use-gesture handles drag, Framer Motion handles position */}
            <motion.div
                ref={cardRef}
                data-draggable="true"
                style={{ x, touchAction: 'pan-y' }}
                className="relative bg-theme-primary rounded-xl cursor-grab active:cursor-grabbing overflow-hidden"
            >
                {children}
            </motion.div>
        </div>
    );
};

export default SwipeableNotification;

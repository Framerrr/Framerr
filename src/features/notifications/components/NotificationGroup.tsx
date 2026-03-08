import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, X } from 'lucide-react';
import SwipeableStack from './SwipeableStack';
import { SOURCE_CONFIG } from '../types/notificationCenter.types';
import type { NotificationGroupProps } from '../types/notificationCenter.types';

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

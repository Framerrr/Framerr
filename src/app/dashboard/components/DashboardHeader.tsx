import React, { useMemo } from 'react';
import { Edit } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getGreeting, getLoadingMessage } from '../../../utils/greetings';
import type { GreetingTone } from '../../../utils/greetings';
import { getIconComponent } from '../../../utils/iconUtils';
import { Link, Unlink } from 'lucide-react';
import type { User } from '../../../../shared/types/user';

/**
 * DashboardHeader - Greeting, edit button, tagline, and debug badges.
 * 
 * Extracted from Dashboard.tsx to isolate header presentation and greeting logic.
 * Greeting computation (autoGreeting, loadingMsg, GreetingIcon) is co-located here
 * since it is only consumed by this component.
 */

export interface DashboardHeaderProps {
    user: User | null;
    greetingMode: string;
    greetingText: string;
    tones: string[];
    headerVisible: boolean;
    taglineEnabled: boolean;
    taglineText: string;
    editMode: boolean;
    isMobile: boolean;
    hideMobileEditButton: boolean;
    mobileLayoutMode: string;
    pendingUnlink: boolean;
    debugOverlayEnabled: boolean;
    onToggleEdit: (isTouch?: boolean) => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    user,
    greetingMode,
    greetingText,
    tones,
    headerVisible,
    taglineEnabled,
    taglineText,
    editMode,
    isMobile,
    hideMobileEditButton,
    mobileLayoutMode,
    pendingUnlink,
    debugOverlayEnabled,
    onToggleEdit,
}) => {
    // ========== GREETING LOGIC ==========

    // Auto greeting - memoized so it doesn't change on every render
    const autoGreeting = useMemo(() => {
        if (greetingMode !== 'auto') return null;
        return getGreeting(user?.displayName || user?.username || 'User', tones as GreetingTone[]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [greetingMode, user?.displayName, user?.username, tones]);

    // Resolve the greeting icon component if available
    const GreetingIcon = useMemo(() => {
        if (!autoGreeting?.icon) return null;
        return getIconComponent(autoGreeting.icon);
    }, [autoGreeting?.icon]);

    // Determine greeting text to display
    const username = user?.displayName || user?.username || 'User';
    const displayGreetingText = greetingMode === 'auto'
        ? (autoGreeting?.text || `Welcome back, ${username}`)
        : ((greetingText || `Welcome back, ${username}`).replace(/\{user\}/gi, username));

    return (
        <>
            {/* Edit Button - standalone when header is hidden */}
            {!headerVisible && !(isMobile && hideMobileEditButton) && (
                <div
                    className="flex justify-end transition-opacity duration-150"
                    style={{
                        opacity: editMode ? 0 : 1,
                        visibility: editMode ? 'hidden' : 'visible',
                        pointerEvents: editMode ? 'none' : 'auto',
                    }}
                >
                    <button
                        onPointerUp={(e) => {
                            const isTouch = e.pointerType === 'touch';
                            onToggleEdit(isTouch);
                        }}
                        className="p-2 rounded-lg text-theme-tertiary opacity-40 hover:opacity-90 hover:bg-theme-hover transition-all duration-300"
                        title="Edit dashboard"
                    >
                        <Edit size={16} />
                    </button>
                </div>
            )}

            {/* Header - conditionally visible, always static (no layout-shifting animations) */}
            {headerVisible && (
                <header className={`${taglineEnabled ? 'mb-8' : 'mb-4'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {GreetingIcon && autoGreeting?.iconColor && (
                                <span style={{ color: autoGreeting.iconColor }} className="flex-shrink-0 flex items-center">
                                    <GreetingIcon size={28} />
                                </span>
                            )}
                            <h1 className="text-4xl font-bold gradient-text">
                                {displayGreetingText}
                            </h1>
                        </div>
                        {!editMode && !(isMobile && hideMobileEditButton) && (
                            <button
                                onClick={() => onToggleEdit(isMobile)}
                                className="p-2 rounded-lg text-theme-tertiary opacity-40 hover:opacity-90 hover:bg-theme-hover transition-all duration-300 flex-shrink-0 cursor-pointer"
                                title="Edit dashboard"
                                data-walkthrough="edit-button"
                            >
                                <Edit size={16} />
                            </button>
                        )}
                    </div>
                    {/* Subtitle area — tagline crossfades to edit text in place (no height change) */}
                    <AnimatePresence mode="wait">
                        {taglineEnabled && (
                            editMode ? (
                                <motion.p
                                    key="edit-subtitle"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-lg text-theme-secondary mt-2"
                                >
                                    {isMobile
                                        ? 'Hold to drag and rearrange widgets'
                                        : 'Editing mode — Drag to rearrange widgets'}
                                </motion.p>
                            ) : (
                                <motion.p
                                    key="tagline"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-lg text-theme-secondary mt-2"
                                >
                                    {taglineText}
                                </motion.p>
                            )
                        )}
                    </AnimatePresence>
                    {debugOverlayEnabled && (
                        <div className="flex items-center gap-2 mt-2">
                            <span
                                className="text-xs px-2 py-1 rounded opacity-80"
                                style={{
                                    backgroundColor: mobileLayoutMode === 'linked' ? 'var(--info)' : 'var(--success)',
                                    color: 'var(--text-primary)',
                                }}
                            >
                                {mobileLayoutMode.toUpperCase()}
                            </span>
                            {pendingUnlink && (
                                <span className="text-xs px-2 py-1 rounded bg-warning/20 text-warning">
                                    PENDING UNLINK
                                </span>
                            )}
                        </div>
                    )}
                </header>
            )}
        </>
    );
};

export default DashboardHeader;

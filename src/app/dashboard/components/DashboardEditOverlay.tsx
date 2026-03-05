import React from 'react';
import { Link, Unlink } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import DashboardEditBar from './DashboardEditBar';

/**
 * DashboardEditOverlay - Edit mode subtitle, edit bar, and mobile link status badge.
 * 
 * Extracted from Dashboard.tsx to isolate edit-mode presentation.
 * Contains AnimatePresence wrappers for the edit-mode section.
 */

export interface DashboardEditOverlayProps {
    editMode: boolean;
    isMobile: boolean;
    taglineEnabled: boolean;
    headerVisible: boolean;
    mobileLayoutMode: 'linked' | 'independent';
    pendingUnlink: boolean;
    hasUnsavedChanges: boolean;
    saving: boolean;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onAddWidget: () => void;
    onRelink: () => void;
    onSave: () => void;
    onCancel: () => void;
}

const DashboardEditOverlay: React.FC<DashboardEditOverlayProps> = ({
    editMode,
    isMobile,
    taglineEnabled,
    headerVisible,
    mobileLayoutMode,
    pendingUnlink,
    hasUnsavedChanges,
    saving,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onAddWidget,
    onRelink,
    onSave,
    onCancel,
}) => {
    return (
        <>
            {/* Part 1: Subtitle (height-clip animation) */}
            <AnimatePresence>
                {editMode && !isMobile && (!taglineEnabled || !headerVisible) && (
                    <motion.div
                        key="edit-subtitle"
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{
                            type: 'spring',
                            damping: 32,
                            stiffness: 300,
                            mass: 0.8,
                            restDelta: 2,
                        }}
                        style={{ overflow: 'hidden' }}
                    >
                        <p className="text-lg text-theme-secondary mb-3 text-center">
                            {isMobile
                                ? 'Hold to drag and rearrange widgets'
                                : 'Editing mode — Drag to rearrange widgets'}
                        </p>

                        {/* Mobile link status badge (shown in edit section when no tagline) */}
                        {isMobile && (
                            <div className="flex items-center justify-center gap-2 mb-3">
                                <span
                                    className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 font-medium ${(mobileLayoutMode === 'independent' || pendingUnlink)
                                        ? 'bg-warning/20 text-warning'
                                        : 'bg-success/20 text-success'
                                        }`}
                                >
                                    {(mobileLayoutMode === 'independent' || pendingUnlink) ? (
                                        <>
                                            <Unlink size={12} />
                                            Independent
                                        </>
                                    ) : (
                                        <>
                                            <Link size={12} />
                                            Linked
                                        </>
                                    )}
                                </span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Part 2: Edit bar (sticky, opacity animation) */}
            <AnimatePresence>
                {editMode && !isMobile && (
                    <motion.div
                        key="edit-bar"
                        initial={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' as const }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 12, overflow: 'visible' as const }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' as const }}
                        transition={{
                            type: 'spring',
                            damping: 32,
                            stiffness: 300,
                            mass: 0.8,
                            restDelta: 2,
                            overflow: { delay: 0.15 },
                        }}
                        className="sticky top-0 z-30 py-1"
                    >
                        <DashboardEditBar
                            canUndo={canUndo}
                            canRedo={canRedo}
                            onUndo={onUndo}
                            onRedo={onRedo}
                            mobileLayoutMode={mobileLayoutMode}
                            pendingUnlink={pendingUnlink}
                            isMobile={isMobile}
                            hasUnsavedChanges={hasUnsavedChanges}
                            saving={saving}
                            onAddWidget={onAddWidget}
                            onRelink={onRelink}
                            onSave={onSave}
                            onCancel={onCancel}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile edit mode subtitle — shown in header when tagline is on */}
            {editMode && isMobile && headerVisible && taglineEnabled && (
                <div className="flex items-center gap-2 mb-3 -mt-6">
                    <span
                        className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 font-medium ${(mobileLayoutMode === 'independent' || pendingUnlink)
                            ? 'bg-warning/20 text-warning'
                            : 'bg-success/20 text-success'
                            }`}
                    >
                        {(mobileLayoutMode === 'independent' || pendingUnlink) ? (
                            <>
                                <Unlink size={12} />
                                Independent
                            </>
                        ) : (
                            <>
                                <Link size={12} />
                                Linked
                            </>
                        )}
                    </span>
                </div>
            )}
        </>
    );
};

export default DashboardEditOverlay;

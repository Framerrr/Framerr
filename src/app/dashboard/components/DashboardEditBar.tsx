import React from 'react';
import { motion } from 'framer-motion';
import {
    X as XIcon,
    Plus,
    Save,
    Undo2,
    Redo2,
    Link,
    Unlink
} from 'lucide-react';

interface DashboardEditBarProps {
    // Undo/Redo
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;

    // Mobile status
    mobileLayoutMode: 'linked' | 'independent';
    pendingUnlink: boolean;
    isMobile: boolean;

    // Actions
    hasUnsavedChanges: boolean;
    saving: boolean;
    onAddWidget: () => void;
    onRelink: () => void;
    onSave: () => void;
    onCancel: () => void;
}

/**
 * DashboardEditBar - Floating action bar for desktop edit mode
 * 
 * Shows above the grid with:
 * Cancel | Undo | Redo | Link Status | Add | Save
 */
const DashboardEditBar: React.FC<DashboardEditBarProps> = ({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    mobileLayoutMode,
    pendingUnlink,
    isMobile,
    hasUnsavedChanges,
    saving,
    onAddWidget,
    onRelink,
    onSave,
    onCancel,
}) => {
    // Determine effective mobile mode status
    const showAsIndependent = mobileLayoutMode === 'independent' || pendingUnlink;
    const showRelinkButton = showAsIndependent;

    return (
        <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{
                duration: 0.35,
                ease: [0.4, 0, 0.2, 1], // Material Design ease-out
                opacity: { duration: 0.2 }
            }}
            style={{ overflow: 'hidden' }}
            className="sticky top-3 z-30 mx-auto max-w-fit"
        >
            <div
                className="glass-subtle flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl"
                style={{
                    borderWidth: '1px',
                    borderColor: 'var(--border)',
                }}
            >
                {/* Cancel Button */}
                <button
                    onClick={onCancel}
                    className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg 
                        text-error hover:bg-theme-tertiary transition-colors text-sm"
                    title="Cancel editing"
                >
                    <XIcon size={16} />
                    <span className="hidden sm:inline">Cancel</span>
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-theme-tertiary/30" />

                {/* Undo Button */}
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg 
                        transition-colors text-sm
                        ${canUndo
                            ? 'text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary cursor-pointer'
                            : 'text-theme-tertiary cursor-not-allowed opacity-50'
                        }`}
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 size={16} />
                    <span className="hidden sm:inline">Undo</span>
                </button>

                {/* Redo Button */}
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg 
                        transition-colors text-sm
                        ${canRedo
                            ? 'text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary cursor-pointer'
                            : 'text-theme-tertiary cursor-not-allowed opacity-50'
                        }`}
                    title="Redo (Ctrl+Shift+Z)"
                >
                    <Redo2 size={16} />
                    <span className="hidden sm:inline">Redo</span>
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-theme-tertiary/30" />

                {/* Mobile Status Badge */}
                <div
                    className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium
                        ${showAsIndependent
                            ? 'bg-warning/20 text-warning'
                            : 'bg-success/20 text-success'
                        }`}
                >
                    {showAsIndependent ? <Unlink size={14} /> : <Link size={14} />}
                    <span className="hidden sm:inline">{showAsIndependent ? 'Independent' : 'Linked'}</span>
                </div>

                {/* Relink Button (only shown when independent) */}
                {showRelinkButton && (
                    <button
                        onClick={onRelink}
                        className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg 
                            text-accent hover:bg-theme-tertiary transition-colors text-sm"
                        title="Re-link mobile to desktop layout"
                    >
                        <Link size={16} />
                        <span className="hidden sm:inline">Relink</span>
                    </button>
                )}

                {/* Divider */}
                <div className="w-px h-6 bg-theme-tertiary/30" />

                {/* Add Widget Button */}
                <button
                    onClick={onAddWidget}
                    className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg 
                        text-accent hover:bg-theme-tertiary transition-colors text-sm"
                    title="Add widget"
                >
                    <Plus size={16} />
                    <span className="hidden sm:inline">Add</span>
                </button>

                {/* Save Button */}
                <button
                    onClick={onSave}
                    disabled={!hasUnsavedChanges || saving}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg 
                        text-sm font-medium transition-colors
                        ${hasUnsavedChanges && !saving
                            ? 'text-accent hover:bg-theme-tertiary cursor-pointer'
                            : 'text-theme-tertiary cursor-not-allowed opacity-50'
                        }`}
                    title="Save changes"
                >
                    <Save size={16} />
                    <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
                </button>
            </div>
        </motion.div>
    );
};

export default DashboardEditBar;

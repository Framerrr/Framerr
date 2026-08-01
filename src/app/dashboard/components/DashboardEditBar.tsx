import React from 'react';
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
 * Pure presentational component — renders the glass bar UI.
 * Animation is orchestrated by Dashboard.tsx's edit section wrapper.
 *
 * Shows: Cancel | Undo | Redo | Link Status | Add | Save
 *
 * Spacing uses the parent @container so gaps/padding compress when the
 * content column is narrow (sidebar open) instead of overflowing.
 */
const DashboardEditBar: React.FC<DashboardEditBarProps> = ({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    mobileLayoutMode,
    pendingUnlink,
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

    // Compact by default; expand when the edit-bar container has room
    const btn =
        'flex items-center gap-1 @[520px]:gap-1.5 px-1.5 @[480px]:px-2 @[600px]:px-3 py-1.5 rounded-lg text-sm transition-colors shrink-0';
    const saveBtn =
        'flex items-center gap-1 @[520px]:gap-1.5 px-2 @[480px]:px-3 @[600px]:px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0';

    return (
        <div
            className="glass-subtle flex items-center justify-center gap-0.5 @[480px]:gap-1 @[600px]:gap-2 px-1.5 @[480px]:px-2 @[600px]:px-4 py-2 rounded-xl mx-auto w-max max-w-full min-w-0 box-border"
            style={{
                borderWidth: '1px',
                borderColor: 'var(--border)',
            }}
        >
            {/* Cancel Button */}
            <button
                onClick={onCancel}
                className={`${btn} text-error hover:bg-theme-tertiary cursor-pointer`}
                title="Cancel editing"
            >
                <XIcon size={16} />
                <span>Cancel</span>
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-theme-tertiary/30 shrink-0" />

            {/* Undo Button */}
            <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`${btn} ${canUndo
                    ? 'text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary cursor-pointer'
                    : 'text-theme-tertiary cursor-not-allowed opacity-50'
                    }`}
                title="Undo (Ctrl+Z)"
            >
                <Undo2 size={16} />
                <span>Undo</span>
            </button>

            {/* Redo Button */}
            <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`${btn} ${canRedo
                    ? 'text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary cursor-pointer'
                    : 'text-theme-tertiary cursor-not-allowed opacity-50'
                    }`}
                title="Redo (Ctrl+Shift+Z)"
            >
                <Redo2 size={16} />
                <span>Redo</span>
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-theme-tertiary/30 shrink-0" />

            {/* Mobile Status Badge */}
            <div
                className={`flex items-center gap-1 @[520px]:gap-1.5 px-1.5 @[480px]:px-2 @[600px]:px-3 py-1.5 rounded-lg text-xs font-medium shrink-0
                    ${showAsIndependent
                        ? 'bg-warning/20 text-warning'
                        : 'bg-success/20 text-success'
                    }`}
            >
                {showAsIndependent ? <Unlink size={14} /> : <Link size={14} />}
                <span>{showAsIndependent ? 'Independent' : 'Linked'}</span>
            </div>

            {/* Relink Button (only shown when independent) */}
            {showRelinkButton && (
                <button
                    onClick={onRelink}
                    className={`${btn} text-accent hover:bg-theme-tertiary cursor-pointer`}
                    title="Re-link mobile to desktop layout"
                >
                    <Link size={16} />
                    <span>Relink</span>
                </button>
            )}

            {/* Divider */}
            <div className="w-px h-6 bg-theme-tertiary/30 shrink-0" />

            {/* Add Widget Button */}
            <button
                onClick={onAddWidget}
                data-walkthrough="add-widget-button"
                className={`${btn} text-accent hover:bg-theme-tertiary cursor-pointer`}
                title="Add widget"
            >
                <Plus size={16} />
                <span>Add</span>
            </button>

            {/* Save Button */}
            <button
                onClick={onSave}
                disabled={!hasUnsavedChanges || saving}
                className={`${saveBtn} ${hasUnsavedChanges && !saving
                    ? 'text-accent hover:bg-theme-tertiary cursor-pointer'
                    : 'text-theme-tertiary cursor-not-allowed opacity-50'
                    }`}
                title="Save changes"
            >
                <Save size={16} />
                <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
        </div>
    );
};

export default DashboardEditBar;

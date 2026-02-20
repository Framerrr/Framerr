/**
 * TemplateCard - Individual template display card
 * 
 * Displays template info with actions: Apply, Edit, Duplicate, Delete
 * Responsive layout: Desktop = row, Mobile = stacked
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Copy, Play, Clock, Share2, Star, RefreshCw, RotateCcw, Tag, AlertTriangle } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { ConfirmButton } from '../../../shared/ui';
import TemplateThumbnail from './TemplateThumbnail';
import { useLayout } from '../../../context/LayoutContext';

export interface Template {
    id: string;
    name: string;
    description?: string;
    categoryId?: string;
    categoryName?: string;
    ownerId: string;
    ownerUsername?: string;
    widgets: Array<{ type: string; layout: { x: number; y: number; w: number; h: number }; shareSensitiveConfig?: boolean }>;
    isDraft: boolean;
    isDefault?: boolean;
    sharedBy?: string;
    hasUpdate?: boolean;
    userModified?: boolean;
    sharedFromId?: string;
    shareCount?: number; // Number of users this template is shared with (for admin view)
    createdAt: string;
    updatedAt: string;
    // Mobile layout independence
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: Array<{ type: string; layout: { x: number; y: number; w: number; h: number }; config?: Record<string, unknown> }>;
}

interface TemplateCardProps {
    template: Template;
    onApply: (template: Template) => void;
    onEdit: (template: Template) => void;
    onDuplicate: (template: Template) => void;
    onDelete: (template: Template) => void;
    onShare?: (template: Template) => void;
    onSync?: (template: Template) => void;
    onRevert?: (template: Template) => void;
    onNameChange: (template: Template, newName: string) => void;
    onPreview?: (template: Template) => void;
    isAdmin?: boolean;
    isBeingPreviewed?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
    template,
    onApply,
    onEdit,
    onDuplicate,
    onDelete,
    onShare,
    onSync,
    onRevert,
    onNameChange,
    onPreview,
    isAdmin = false,
    isBeingPreviewed = false,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(template.name);
    const { isMobile } = useLayout();

    const handleNameSave = () => {
        if (editedName.trim() && editedName !== template.name) {
            onNameChange(template, editedName.trim());
        }
        setIsEditing(false);
    };

    const handleNameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNameSave();
        } else if (e.key === 'Escape') {
            setEditedName(template.name);
            setIsEditing(false);
        }
    };

    // Is this a shared template (not owned by admin)?
    const isSharedCopy = !!template.sharedBy;

    // Badges JSX for reuse - Stack vertically, distinct colors per type
    // Category is rendered separately under the name
    const badgesSection = (
        <div className="flex flex-col items-start gap-1">
            {template.isDraft && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs">
                    <Edit2 size={12} />
                    <span>Draft</span>
                </div>
            )}
            {template.sharedBy && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">
                    <Share2 size={12} />
                    <span>by {template.sharedBy}</span>
                </div>
            )}
            {/* Admin: Show share count if shared */}
            {isAdmin && !isSharedCopy && template.shareCount && template.shareCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs">
                    <Share2 size={12} />
                    <span>with {template.shareCount}</span>
                </div>
            )}
            {template.isDefault && isAdmin && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">
                    <Star size={12} />
                    <span>Default</span>
                </div>
            )}
            {template.hasUpdate && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-success/20 text-success text-xs animate-pulse">
                    <Clock size={12} />
                    <span>Update</span>
                </div>
            )}
            {/* Admin: Show warning if any widget has sensitive config shared */}
            {isAdmin && !isSharedCopy && template.widgets.some(w => w.shareSensitiveConfig) && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs" title="This template shares sensitive widget configs (links, HTML) with recipients">
                    <AlertTriangle size={12} />
                    <span>Sensitive</span>
                </div>
            )}
        </div>
    );

    // Actions JSX for reuse - split into two groups for even wrapping
    const actionsSection = (
        <div className="flex flex-wrap gap-2">
            {template.isDraft ? (
                // Draft templates: Only Edit and Delete
                <>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onEdit(template)}
                        title="Continue editing draft"
                    >
                        <Edit2 size={14} />
                        Edit
                    </Button>
                    <ConfirmButton
                        onConfirm={() => onDelete(template)}
                        size="sm"
                        confirmMode="iconOnly"
                        anchorButton="cancel"
                        expandDirection="left"
                    />
                </>
            ) : (
                // Published templates: Full action set (split into two groups)
                <>
                    {/* Primary group: Apply + Edit (stay together) */}
                    <div className="flex items-center gap-2 flex-none">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onApply(template)}
                            title="Apply template"
                        >
                            <Play size={14} />
                            Apply
                        </Button>

                        {/* Sync button for shared templates with updates */}
                        {isSharedCopy && template.hasUpdate && onSync && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onSync(template)}
                                title="Sync with latest version"
                                className="bg-success/25 text-success hover:bg-success/10"
                            >
                                <RefreshCw size={14} />
                            </Button>
                        )}

                        {/* Revert button for user-modified shared templates */}
                        {isSharedCopy && template.userModified && !template.hasUpdate && onRevert && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRevert(template)}
                                title="Revert to shared version"
                                className="bg-accent/25 hover:bg-accent/10"
                            >
                                <RotateCcw size={14} />
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(template)}
                            title="Edit template"
                            className="bg-accent/25 hover:bg-accent/10"
                        >
                            <Edit2 size={14} />
                        </Button>
                    </div>

                    {/* Secondary group: Duplicate + Share (wrap together) */}
                    <div className="flex items-center gap-2 flex-none">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDuplicate(template)}
                            title="Duplicate template"
                            className="bg-accent/25 hover:bg-accent/10"
                        >
                            <Copy size={14} />
                        </Button>
                        {/* Share/Export button - visible to all users */}
                        {!isSharedCopy && onShare && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onShare(template)}
                                title={isAdmin ? "Share template" : "Export template"}
                                className="bg-accent/25 hover:bg-accent/10"
                            >
                                <Share2 size={14} />
                            </Button>
                        )}
                    </div>
                    <ConfirmButton
                        onConfirm={() => onDelete(template)}
                        size="sm"
                        confirmMode="iconOnly"
                        anchorButton="cancel"
                        expandDirection="left"
                    />
                </>
            )}
        </div>
    );

    // Mobile layout (stacked)
    if (isMobile) {
        return (
            <div className={`flex flex-col gap-3 p-4 rounded-lg border transition-colors ${template.isDraft
                ? 'bg-accent/5 border-accent/30'
                : 'bg-theme-tertiary border-theme'
                }`}>
                {/* Row 1: Thumbnail + Name + Badges */}
                <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <motion.button
                        layoutId={`template-preview-${template.id}`}
                        onClick={() => onPreview?.(template)}
                        className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden hover:ring-2 hover:ring-accent/50 transition-all cursor-pointer"
                        title="Preview template"
                        style={{ opacity: isBeingPreviewed ? 0 : 1 }}
                    >
                        <TemplateThumbnail widgets={template.widgets} width={64} height={64} />
                    </motion.button>

                    {/* Name + Category */}
                    <div className="flex-1 min-w-0">
                        {isEditing ? (
                            <input
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                onBlur={handleNameSave}
                                onKeyDown={handleNameKeyDown}
                                className="w-full px-2 py-1 text-sm bg-theme-secondary border border-theme rounded text-theme-primary focus:border-accent outline-none"
                                autoFocus
                            />
                        ) : (
                            <h3
                                className="font-medium text-theme-primary truncate cursor-pointer hover:text-accent text-sm"
                                onClick={() => {
                                    setEditedName(template.name);
                                    setIsEditing(true);
                                }}
                                title={template.name}
                            >
                                {template.name}
                            </h3>
                        )}
                        {/* Category under name */}
                        {template.categoryName && (
                            <div className="flex items-center gap-1 text-xs text-theme-tertiary mt-0.5 truncate" title={template.categoryName}>
                                <Tag size={10} className="flex-shrink-0" />
                                <span className="truncate">{template.categoryName}</span>
                            </div>
                        )}
                    </div>

                    {/* Badges (centered, stacking) */}
                    <div className="flex-shrink-0">
                        {badgesSection}
                    </div>
                </div>

                {/* Row 2: Action buttons */}
                {actionsSection}
            </div>
        );
    }

    // Desktop layout (row)
    return (
        <div className={`flex flex-wrap items-center gap-4 p-4 rounded-lg border transition-colors group ${template.isDraft
            ? 'bg-accent/5 border-accent/30 hover:border-accent/60'
            : 'bg-theme-tertiary border-theme hover:border-accent/50'
            }`}>
            {/* Thumbnail - clickable to preview */}
            <motion.button
                layoutId={`template-preview-${template.id}`}
                onClick={() => onPreview?.(template)}
                className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden hover:ring-2 hover:ring-accent/50 transition-all cursor-pointer"
                title="Preview template"
                style={{ opacity: isBeingPreviewed ? 0 : 1 }}
            >
                <TemplateThumbnail widgets={template.widgets} width={80} height={80} />
            </motion.button>

            {/* Info */}
            <div className="flex-1 min-w-0">
                {/* Name */}
                {isEditing ? (
                    <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onBlur={handleNameSave}
                        onKeyDown={handleNameKeyDown}
                        className="w-full px-2 py-1 text-sm bg-theme-secondary border border-theme rounded text-theme-primary focus:border-accent outline-none"
                        autoFocus
                    />
                ) : (
                    <h3
                        className="font-medium text-theme-primary group-hover:text-accent transition-colors cursor-pointer truncate"
                        onClick={() => {
                            setEditedName(template.name);
                            setIsEditing(true);
                        }}
                    >
                        {template.name}
                    </h3>
                )}

                {/* Category under name */}
                {template.categoryName && (
                    <div className="flex items-center gap-1 text-xs text-theme-tertiary mt-0.5 truncate" title={template.categoryName}>
                        <Tag size={10} className="flex-shrink-0" />
                        <span className="truncate">{template.categoryName}</span>
                    </div>
                )}

                {/* Description */}
                {template.description && (
                    <p className="text-xs text-theme-tertiary line-clamp-1">
                        {template.description}
                    </p>
                )}
            </div>

            {/* Badges */}
            <div className="flex-shrink-0">
                {badgesSection}
            </div>

            {/* Actions - allow to shrink and wrap */}
            <div className="flex-shrink min-w-0">
                {actionsSection}
            </div>
        </div>
    );
};

export default TemplateCard;

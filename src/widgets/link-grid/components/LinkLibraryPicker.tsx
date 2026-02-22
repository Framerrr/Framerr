/**
 * LinkLibraryPicker Component
 * 
 * Popover-based dropdown for the link library (template catalog).
 * Shows all library templates with per-item action buttons:
 * - Click row = pre-fill form with template data
 * - ✏️ Edit = edit library template
 * - 🗑️ Delete = inline confirm, delete from library
 */

import React, { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Popover, ConfirmButton } from '../../../shared/ui';
import { Input } from '../../../components/common/Input';
import { getIconComponent } from '../../../utils/iconUtils';
import type { Link } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface LibraryLink extends Link {
    /** Additional metadata from library */
    createdAt?: string;
    updatedAt?: string;
}

interface LinkLibraryPickerProps {
    /** All templates in the user's library */
    libraryLinks: LibraryLink[];
    /** Called when user clicks a row to pre-fill the form */
    onSelect: (link: LibraryLink) => void;
    /** Called when user clicks delete on a template */
    onDelete: (linkId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const LinkLibraryPicker: React.FC<LinkLibraryPickerProps> = ({
    libraryLinks,
    onSelect,
    onDelete,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredLinks = libraryLinks.filter(link =>
        link.title.toLowerCase().includes(search.toLowerCase()) ||
        (link.url && link.url.toLowerCase().includes(search.toLowerCase()))
    );

    if (libraryLinks.length === 0) return null;

    return (
        <Popover open={open} onOpenChange={setOpen} closeOnScroll={false}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    className={`
                        w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
                        border transition-colors
                        ${open
                            ? 'border-accent text-accent bg-accent/5'
                            : 'border-theme text-theme-secondary bg-theme-tertiary'
                        }
                    `}
                >
                    <BookOpen size={14} className="flex-shrink-0" />
                    <span className="flex-1 text-left">Saved Links</span>
                    <span className="text-xs text-theme-tertiary">{libraryLinks.length} saved</span>
                </button>
            </Popover.Trigger>
            <Popover.Content
                side="bottom"
                align="start"
                sideOffset={4}
                className="w-[var(--radix-popover-trigger-width)] p-1"
            >
                {/* Search */}
                <div className="px-1 pb-1 mb-1 border-b border-theme">
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search links..."
                        icon={Search}
                        size="sm"
                        className="!mb-0"
                        autoFocus
                    />
                </div>

                {/* Template List */}
                <div className="overflow-y-auto max-h-[220px]">
                    {filteredLinks.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-theme-tertiary">
                            {search ? 'No templates match your search' : 'No templates in library'}
                        </div>
                    ) : (
                        filteredLinks.map(link => {
                            const Icon = getIconComponent(link.icon);

                            return (
                                <div
                                    key={link.id}
                                    className="group flex items-center gap-3 px-3 py-3.5 rounded-md transition-colors text-sm hover:bg-theme-hover cursor-pointer"
                                    onClick={() => {
                                        onSelect(link);
                                        setOpen(false);
                                    }}
                                >
                                    {/* Icon */}
                                    <div className="flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center bg-theme-hover">
                                        <Icon size={18} className="text-theme-secondary" />
                                    </div>

                                    {/* Title + URL */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-theme-primary truncate">
                                            {link.title || 'Untitled'}
                                        </div>
                                        {link.url && (
                                            <div className="text-xs text-theme-tertiary truncate">
                                                {link.url}
                                            </div>
                                        )}
                                    </div>

                                    {/* Delete button - show on hover */}
                                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                        <ConfirmButton
                                            onConfirm={() => onDelete(link.id)}
                                            label=""
                                            size="sm"
                                            confirmMode="iconOnly"
                                            showTriggerIcon={true}
                                        />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </Popover.Content>
        </Popover >
    );
};

export default LinkLibraryPicker;

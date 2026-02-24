/**
 * LinkLibraryPicker Component
 * 
 * Popover-based dropdown for the link library (template catalog).
 * Shows all library templates with per-item action buttons:
 * - Click row = pre-fill form with template data
 * - 🗑️ Delete = inline confirm, delete from library
 */

import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { ActionSelect, ConfirmButton } from '../../../shared/ui';
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
    const [search, setSearch] = useState('');

    const filteredLinks = libraryLinks.filter(link =>
        link.title.toLowerCase().includes(search.toLowerCase()) ||
        (link.url && link.url.toLowerCase().includes(search.toLowerCase()))
    );

    if (libraryLinks.length === 0) return null;

    return (
        <ActionSelect closeOnScroll={false}>
            <ActionSelect.Trigger>
                <button
                    type="button"
                    className="
                        w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
                        border transition-colors
                        border-theme text-theme-secondary bg-theme-tertiary
                    "
                >
                    <BookOpen size={14} className="flex-shrink-0" />
                    <span className="flex-1 text-left">Saved Links</span>
                    <span className="text-xs text-theme-tertiary">{libraryLinks.length} saved</span>
                </button>
            </ActionSelect.Trigger>
            <ActionSelect.Content>
                <ActionSelect.Search
                    value={search}
                    onChange={setSearch}
                    placeholder="Search links..."
                />
                <ActionSelect.Items>
                    {filteredLinks.length === 0 ? (
                        <ActionSelect.Empty>
                            {search ? 'No templates match your search' : 'No templates in library'}
                        </ActionSelect.Empty>
                    ) : (
                        filteredLinks.map(link => {
                            const Icon = getIconComponent(link.icon);

                            return (
                                <ActionSelect.Item
                                    key={link.id}
                                    onClick={() => onSelect(link)}
                                    action={
                                        <ConfirmButton
                                            onConfirm={() => onDelete(link.id)}
                                            label=""
                                            size="sm"
                                            confirmMode="iconOnly"
                                            showTriggerIcon={true}
                                        />
                                    }
                                    className="!py-2.5"
                                >
                                    <div className="flex items-center gap-3">
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
                                    </div>
                                </ActionSelect.Item>
                            );
                        })
                    )}
                </ActionSelect.Items>
            </ActionSelect.Content>
        </ActionSelect>
    );
};

export default LinkLibraryPicker;

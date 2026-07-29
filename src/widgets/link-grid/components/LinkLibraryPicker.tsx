/**
 * LinkLibraryPicker Component
 *
 * Popover-based dropdown for the link library (template catalog).
 */

import React from 'react';
import { BookOpen } from 'lucide-react';
import { LinkSourceList } from './LinkSourceList';
import type { Link } from '../types';

export interface LibraryLink extends Link {
    createdAt?: string;
    updatedAt?: string;
}

interface LinkLibraryPickerProps {
    libraryLinks: LibraryLink[];
    onSelect: (link: LibraryLink) => void;
    onDelete: (linkId: string) => void;
}

export const LinkLibraryPicker: React.FC<LinkLibraryPickerProps> = ({
    libraryLinks,
    onSelect,
    onDelete,
}) => {
    if (libraryLinks.length === 0) return null;

    const items = libraryLinks.map(link => ({
        ...link,
        subtitle: link.url,
    }));

    return (
        <LinkSourceList
            items={items}
            triggerLabel="Saved Links"
            triggerIcon={BookOpen}
            countLabel={(n) => `${n} saved`}
            emptyLabel="No templates in library"
            searchPlaceholder="Search links..."
            onSelect={(item) => onSelect(item as LibraryLink)}
            onDelete={onDelete}
        />
    );
};

export default LinkLibraryPicker;

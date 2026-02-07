/**
 * useLinkForm Hook
 * 
 * Manages form state for adding/editing links.
 * Handles save, delete, and form population.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Link, LinkFormData, LinkGridWidgetConfig } from '../types';
import { DEFAULT_FORM_DATA } from '../types';
import logger from '../../../utils/logger';

interface UseLinkFormProps {
    links: Link[];
    widgetId?: string;
    config?: LinkGridWidgetConfig;
    setGlobalDragEnabled?: (enabled: boolean) => void;
}

interface UseLinkFormReturn {
    // Form state
    formData: LinkFormData;
    setFormData: React.Dispatch<React.SetStateAction<LinkFormData>>;
    showAddForm: boolean;
    setShowAddForm: (show: boolean) => void;
    editingLinkId: string | null;
    setEditingLinkId: (id: string | null) => void;

    // Actions
    handleSaveLink: () => void;
    handleDeleteLink: (linkId: string) => void;
    resetForm: () => void;
}

export function useLinkForm({
    links,
    widgetId,
    config,
    setGlobalDragEnabled
}: UseLinkFormProps): UseLinkFormReturn {
    const [formData, setFormData] = useState<LinkFormData>(DEFAULT_FORM_DATA);
    const [showAddForm, setShowAddForm] = useState<boolean>(false);
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

    // Ref for accessing current links without effect dependencies
    const linksRef = useRef<Link[]>(links);
    linksRef.current = links;

    /**
     * Pre-populate form when editing a link
     */
    useEffect(() => {
        if (editingLinkId) {
            const linkToEdit = linksRef.current.find(l => l.id === editingLinkId);
            if (linkToEdit) {
                setFormData({
                    title: linkToEdit.title || '',
                    icon: linkToEdit.icon || 'Link',
                    size: linkToEdit.size || 'circle',
                    type: linkToEdit.type || 'link',
                    url: linkToEdit.url || '',
                    showIcon: linkToEdit.style?.showIcon !== false,
                    showText: linkToEdit.style?.showText !== false,
                    action: linkToEdit.action || {
                        method: 'GET',
                        url: '',
                        headers: {},
                        body: null
                    }
                });
            }
        } else if (!showAddForm) {
            // Reset form when closing
            setFormData(DEFAULT_FORM_DATA);
        }
    }, [editingLinkId, showAddForm]);

    /**
     * Toggle global drag state when modal is open
     */
    useEffect(() => {
        if (setGlobalDragEnabled) {
            setGlobalDragEnabled(!(showAddForm || editingLinkId));
        }
    }, [showAddForm, editingLinkId, setGlobalDragEnabled]);

    /**
     * Save link (create or update)
     */
    const handleSaveLink = useCallback((): void => {
        // Build link object
        const newLink: Link = {
            id: editingLinkId || `link-${Date.now()}`,
            title: formData.title,
            icon: formData.icon,
            size: formData.size,
            type: formData.type,
            url: formData.url,
            style: {
                showIcon: formData.showIcon,
                showText: formData.showText
            },
            action: formData.type === 'action' ? formData.action : undefined
        };

        // Update links array
        const updatedLinks = editingLinkId
            ? links.map(l => l.id === editingLinkId ? newLink : l)
            : [...links, newLink];

        logger.debug(`Link ${editingLinkId ? 'updated' : 'added'} (tentative)`);

        // Close form
        setShowAddForm(false);
        setEditingLinkId(null);

        // Dispatch event to update Dashboard's local state
        window.dispatchEvent(new CustomEvent('widget-config-changed', {
            detail: {
                widgetId,
                config: { ...config, links: updatedLinks }
            }
        }));
    }, [editingLinkId, formData, links, widgetId, config]);

    /**
     * Delete link
     */
    const handleDeleteLink = useCallback((linkId: string): void => {
        // Remove from links array
        const updatedLinks = links.filter(l => l.id !== linkId);

        logger.debug('Link deleted (tentative)');

        // Dispatch event to update Dashboard's local state
        window.dispatchEvent(new CustomEvent('widget-config-changed', {
            detail: {
                widgetId,
                config: { ...config, links: updatedLinks }
            }
        }));
    }, [links, widgetId, config]);

    /**
     * Reset form to defaults
     */
    const resetForm = useCallback((): void => {
        setFormData(DEFAULT_FORM_DATA);
        setShowAddForm(false);
        setEditingLinkId(null);
    }, []);

    return {
        formData,
        setFormData,
        showAddForm,
        setShowAddForm,
        editingLinkId,
        setEditingLinkId,
        handleSaveLink,
        handleDeleteLink,
        resetForm
    };
}

export default useLinkForm;

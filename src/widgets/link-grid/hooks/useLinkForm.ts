/**
 * useLinkForm Hook
 * 
 * Manages form state for adding/editing links.
 * Saves go directly to widget config.
 * Optionally saves to library as a reusable template.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Link, LinkFormData, LinkGridWidgetConfig } from '../types';
import { DEFAULT_FORM_DATA } from '../types';
import { linkLibraryApi } from '../../../api/endpoints/linkLibrary';
import { queryKeys } from '../../../api/queryKeys';
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
    handleSaveToLibrary: () => Promise<void>;
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
    const queryClient = useQueryClient();

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
     * Save link to widget config only (no library involvement)
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

        logger.debug(`Link ${editingLinkId ? 'updated' : 'added'} to widget`);

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
     * Save current form data to library as a reusable template (does NOT add to widget)
     */
    const handleSaveToLibrary = useCallback(async (): Promise<void> => {
        try {
            await linkLibraryApi.create({
                title: formData.title,
                icon: formData.icon,
                size: formData.size,
                type: formData.type,
                url: formData.url,
                style: {
                    showIcon: formData.showIcon,
                    showText: formData.showText
                },
                action: formData.type === 'action' ? formData.action : undefined,
            });

            // Invalidate library cache so picker shows the new template
            queryClient.invalidateQueries({ queryKey: queryKeys.linkLibrary.list() });
            logger.debug('Form data saved to library as template');
        } catch (error) {
            logger.error(`Failed to save to library: ${(error as Error).message}`);
        }
    }, [formData, queryClient]);

    /**
     * Delete link from widget
     */
    const handleDeleteLink = useCallback((linkId: string): void => {
        const updatedLinks = links.filter(l => l.id !== linkId);

        logger.debug('Link removed from widget');

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
        handleSaveToLibrary,
        handleDeleteLink,
        resetForm
    };
}

export default useLinkForm;

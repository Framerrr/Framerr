/**
 * useDesktopDrag Hook
 * 
 * Handles desktop (mouse) drag-to-reorder for links.
 * Uses HTML5 drag and drop API.
 */

import { useState, useCallback, useEffect, DragEvent } from 'react';
import type { Link, LinkGridWidgetConfig } from '../types';
import logger from '../../../utils/logger';

interface UseDesktopDragProps {
    links: Link[];
    widgetId?: string;
    config?: LinkGridWidgetConfig;
}

interface UseDesktopDragReturn {
    draggedLinkId: string | null;
    dragOverLinkId: string | null;
    previewLinks: Link[];
    handleDragStart: (e: DragEvent<HTMLAnchorElement | HTMLButtonElement>, linkId: string) => void;
    handleDragEnd: (e: DragEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
    handleDragOver: (e: DragEvent<HTMLAnchorElement | HTMLButtonElement>, linkId: string) => void;
    handleDragLeave: () => void;
    handleDrop: (e: DragEvent<HTMLAnchorElement | HTMLButtonElement>, targetLinkId: string) => void;
}

export function useDesktopDrag({
    links,
    widgetId,
    config
}: UseDesktopDragProps): UseDesktopDragReturn {
    const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
    const [dragOverLinkId, setDragOverLinkId] = useState<string | null>(null);
    const [previewLinks, setPreviewLinks] = useState<Link[]>([]);

    // Auto-clear preview when links update from backend (after drop completes)
    useEffect(() => {
        if (previewLinks.length > 0 && !draggedLinkId) {
            setPreviewLinks([]);
        }
    }, [links, draggedLinkId, previewLinks.length]);

    const handleDragStart = useCallback((e: DragEvent<HTMLAnchorElement | HTMLButtonElement>, linkId: string): void => {
        setDraggedLinkId(linkId);
        setPreviewLinks(links); // Initialize preview with current links
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', linkId);

        // Add semi-transparent effect
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
    }, [links]);

    const handleDragEnd = useCallback((e: DragEvent<HTMLAnchorElement | HTMLButtonElement>): void => {
        (e.currentTarget as HTMLElement).style.opacity = '1';
        setDraggedLinkId(null);
        setDragOverLinkId(null);
        // Don't clear previewLinks here - let handleDrop do it after save completes
    }, []);

    const handleDragOver = useCallback((e: DragEvent<HTMLAnchorElement | HTMLButtonElement>, linkId: string): void => {
        e.preventDefault(); // MUST prevent default to allow drop
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';

        if (draggedLinkId && draggedLinkId !== linkId && previewLinks.length > 0) {
            setDragOverLinkId(linkId);

            // Calculate new order for preview
            const draggedIndex = previewLinks.findIndex(l => l.id === draggedLinkId);
            const targetIndex = previewLinks.findIndex(l => l.id === linkId);

            if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
                const newLinks = [...previewLinks];
                const [draggedItem] = newLinks.splice(draggedIndex, 1);
                newLinks.splice(targetIndex, 0, draggedItem);
                setPreviewLinks(newLinks);
            }
        }
    }, [draggedLinkId, previewLinks]);

    const handleDragLeave = useCallback((): void => {
        setDragOverLinkId(null);
    }, []);

    const handleDrop = useCallback((e: DragEvent<HTMLAnchorElement | HTMLButtonElement>, targetLinkId: string): void => {
        e.preventDefault();

        if (!draggedLinkId || previewLinks.length === 0) {
            setDragOverLinkId(null);
            setPreviewLinks([]);
            return;
        }

        // Use the preview links order (already reordered during drag)
        const reorderedLinks = [...previewLinks];

        logger.debug('Links reordered (tentative)');

        // Clear preview state
        setPreviewLinks([]);
        setDragOverLinkId(null);

        // Dispatch event to update Dashboard's local state
        window.dispatchEvent(new CustomEvent('widget-config-changed', {
            detail: {
                widgetId,
                config: { ...config, links: reorderedLinks }
            }
        }));
    }, [draggedLinkId, previewLinks, widgetId, config]);

    return {
        draggedLinkId,
        dragOverLinkId,
        previewLinks,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop
    };
}

export default useDesktopDrag;

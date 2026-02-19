/**
 * LinkGrid Widget
 * 
 * iOS Control Center-style grid layout with inline editing.
 * This is the thin orchestrator that composes all extracted modules.
 * 
 * Features:
 * - Circle links (1x1 cells) and Rectangle links (2x1 cells)
 * - Dynamic grid sizing (40-80px cells)
 * - Left-align in edit mode, center-justify in view mode
 * - Inline add/edit forms
 *
 * NOTE: Live drag-to-reorder (useDesktopDrag / useTouchDrag) is DISABLED.
 * Reordering now happens in the config modal via LinkOrderEditor.
 * The drag hooks are preserved in hooks/ for potential future use elsewhere.
 * See: hooks/useDesktopDrag.ts, hooks/useTouchDrag.ts
 */

import React, { useState, useRef, useEffect } from 'react';

// Types
import type { LinkGridWidgetProps, ContainerSize, Link, LinkGridWidgetConfig } from './types';
import { GRID_CONSTANTS } from './types';

// Utils
import {
    calculateGridMetrics,
    calculateLinkPositions,
    getRemainingCapacity,
    calculateGridDimensions
} from './utils/gridLayout';

// Hooks
import { useLinkForm } from './hooks/useLinkForm';
// DISABLED: Live drag reorder — now handled in config modal (LinkOrderEditor).
// import { useDesktopDrag } from './hooks/useDesktopDrag';
// import { useTouchDrag } from './hooks/useTouchDrag';

// Components
import { GridOutlines } from './components/GridOutlines';
import { AddButton } from './components/AddButton';
// DISABLED: Drag overlay no longer needed without live drag.
// import { DragOverlay } from './components/DragOverlay';
import { LinkItem } from './components/LinkItem';
import { LinkFormModal } from './modals/LinkFormModal';

// Preview mode mock links
const PREVIEW_LINKS: Link[] = [
    { id: 'preview-1', title: 'GitHub', icon: 'Github', size: 'circle', type: 'link' },
    { id: 'preview-2', title: 'Plex', icon: 'Film', size: 'rectangle', type: 'link' },
    { id: 'preview-3', title: 'Google', icon: 'Globe', size: 'circle', type: 'link' },
    { id: 'preview-4', title: 'Discord', icon: 'MessageCircle', size: 'circle', type: 'link' },
];

export const LinkGridWidget: React.FC<LinkGridWidgetProps> = ({
    widget,
    isEditMode = false,
    setGlobalDragEnabled,
    previewMode = false
}) => {
    // In preview mode, use mock links; otherwise use config
    const config = widget.config as LinkGridWidgetConfig | undefined;
    const widgetId = widget.id;
    const { links: configLinks = [], gridJustify = 'center' } = config || {};
    const links = previewMode ? PREVIEW_LINKS : configLinks;
    const editMode = isEditMode; // Alias for internal use

    // Container measurement
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [containerSize, setContainerSize] = useState<ContainerSize>({ width: 0, height: 0 });

    // Grid gap (responsive)
    const gridGap = GRID_CONSTANTS.getGridGap(containerSize.width);

    // Detect touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // === Form Hook ===
    const {
        formData,
        setFormData,
        showAddForm,
        setShowAddForm,
        editingLinkId,
        setEditingLinkId,
        handleSaveLink,
        handleDeleteLink,
        resetForm
    } = useLinkForm({
        links,
        widgetId,
        config,
        setGlobalDragEnabled
    });

    // === DISABLED: Desktop & Touch Drag Hooks ===
    // Reordering now handled via config modal (LinkOrderEditor component).
    // Hooks preserved in hooks/ for potential future reuse.
    // No-op stubs to keep LinkItem props stable:
    const draggedLinkId: string | null = null;
    const dragOverLinkId: string | null = null;
    const previewLinks: Link[] = [];
    const touchDragLinkId: string | null = null;
    const touchDragPosition = null;
    const touchDragTargetSlot: number | null = null;
    const noop = () => { };
    const noopDrag = (_e: React.DragEvent, _id?: string) => { };
    const noopTouch = (_e: React.TouchEvent, _id?: string) => { };

    // === Container Measurement ===
    useEffect(() => {
        const measureContainer = (): void => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setContainerSize({
                    width: rect.width,
                    height: rect.height
                });
            }
        };

        measureContainer();

        // Use ResizeObserver to detect container size changes
        const resizeObserver = new ResizeObserver(() => {
            measureContainer();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // Re-measure when links change or edit mode toggles
    useEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setContainerSize({
                width: rect.width,
                height: rect.height
            });
        }
    }, [links.length, editMode, showAddForm]);

    // Reset form when exiting edit mode
    useEffect(() => {
        if (!editMode) {
            setShowAddForm(false);
            setEditingLinkId(null);
        }
    }, [editMode, setShowAddForm, setEditingLinkId]);

    // === Grid Calculations ===
    const { cols, rows, cellSize, maxRows } = calculateGridMetrics(containerSize, links, gridGap);

    // Determine which links to render (with drag reordering preview)
    let activeLinks: Link[];
    if (touchDragLinkId && touchDragTargetSlot !== null) {
        // Touch drag: create virtual list with dragged item at target slot
        const originalIndex = links.findIndex(l => l.id === touchDragLinkId);
        const otherLinks = links.filter(l => l.id !== touchDragLinkId);
        const draggedLink = links.find(l => l.id === touchDragLinkId);

        if (draggedLink && originalIndex !== -1) {
            activeLinks = [...otherLinks];
            activeLinks.splice(touchDragTargetSlot, 0, draggedLink);
        } else {
            activeLinks = links;
        }
    } else if ((draggedLinkId || touchDragLinkId) && previewLinks.length > 0) {
        activeLinks = previewLinks;
    } else {
        activeLinks = links;
    }

    const linkPositions = calculateLinkPositions(cols, rows, activeLinks);
    const remainingCapacity = getRemainingCapacity(cols, rows, links);
    const { gridWidth, gridHeight } = calculateGridDimensions(
        cols,
        editMode ? maxRows : rows,
        cellSize,
        gridGap,
        linkPositions,
        editMode
    );

    // Justify class
    const justifyClass = gridJustify === 'left' ? 'justify-start'
        : gridJustify === 'center' ? 'justify-center'
            : 'justify-end';

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full flex items-center ${justifyClass}`}
            style={editMode ? {
                touchAction: 'manipulation',
                WebkitUserSelect: 'none',
                userSelect: 'none'
            } : undefined}
        >
            {/* Empty state */}
            {links.length === 0 && !editMode ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-sm text-theme-secondary">No links configured</p>
                    {editMode && (
                        <p className="text-xs text-theme-tertiary mt-1">Click Configure to add links</p>
                    )}
                </div>
            ) : (
                /* Grid container */
                <div
                    className="relative"
                    style={{
                        width: `${gridWidth}px`,
                        height: `${gridHeight}px`
                    }}
                >
                    {/* Grid outlines (edit mode only) */}
                    <GridOutlines
                        cols={cols}
                        rows={editMode ? maxRows : rows}
                        cellSize={cellSize}
                        gridGap={gridGap}
                        linkPositions={linkPositions}
                        editMode={editMode}
                    />

                    {/* Render links */}
                    {linkPositions.map(position => {
                        const link = links.find(l => l.id === position.linkId);
                        return link ? (
                            <LinkItem
                                key={link.id}
                                link={link}
                                position={position}
                                cellSize={cellSize}
                                gridGap={gridGap}
                                editMode={editMode}
                                isTouchDevice={isTouchDevice}
                                dragOverLinkId={dragOverLinkId}
                                touchDragLinkId={touchDragLinkId}
                                editingLinkId={editingLinkId}
                                onLinkClick={(linkId) => {
                                    setEditingLinkId(linkId);
                                    setShowAddForm(false);
                                }}
                                onDragStart={noopDrag}
                                onDragEnd={noopDrag}
                                onDragOver={noopDrag}
                                onDragLeave={noop}
                                onDrop={noopDrag}
                                onTouchStart={noopTouch}
                                onTouchMove={noopTouch}
                                onTouchEnd={noop}
                            />
                        ) : null;
                    })}

                    {/* Add button (edit mode only, if space available) */}
                    {editMode && remainingCapacity > 0 && !showAddForm && (
                        <AddButton
                            linkPositions={linkPositions}
                            cols={cols}
                            cellSize={cellSize}
                            gridGap={gridGap}
                            onClick={() => {
                                setShowAddForm(true);
                                setEditingLinkId(null);
                            }}
                        />
                    )}
                </div>
            )}

            {/* DISABLED: Touch drag overlay — reorder now in config modal */}
            {/* {touchDragLinkId && touchDragPosition && (() => {
                const draggedLink = links.find(l => l.id === touchDragLinkId);
                return draggedLink ? (
                    <DragOverlay
                        link={draggedLink}
                        position={touchDragPosition}
                        cellSize={cellSize}
                    />
                ) : null;
            })()} */}

            {/* Form modal */}
            {editMode && (
                <LinkFormModal
                    isOpen={showAddForm || !!editingLinkId}
                    isEditing={!!editingLinkId}
                    editingLinkId={editingLinkId}
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSaveLink}
                    onDelete={handleDeleteLink}
                    onClose={resetForm}
                />
            )}

            {/* Debug info removed - debugMode prop no longer used */}
        </div>
    );
};

export default LinkGridWidget;

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
 * - Link reordering via config modal (LinkOrderEditor)
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

// Components
import { GridOutlines } from './components/GridOutlines';
import { AddButton } from './components/AddButton';
import { LinkItem } from './components/LinkItem';
import { LinkFormModal } from './modals/LinkFormModal';
import type { LibraryLink } from './components/LinkLibraryPicker';
import { useLinkLibraryLinks, useDeleteLibraryLink } from './hooks/useLinkLibrary';
import type { LinkFormData } from './types';

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

    // === Form Hook ===
    const {
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
    } = useLinkForm({
        links,
        widgetId,
        config,
        setGlobalDragEnabled
    });

    // === Link Library Hook ===
    const { data: libraryLinks = [], isLoading: _libraryLoading } = useLinkLibraryLinks();
    const deleteLibraryLink = useDeleteLibraryLink();



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

    const activeLinks = links;

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
            className={`relative w-full h-full flex items-center ${justifyClass} scroll-contain-x`}
            style={editMode ? {
                touchAction: 'manipulation',
                WebkitUserSelect: 'none',
                userSelect: 'none'
            } : {
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-x pan-y',
            }}
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
                                editingLinkId={editingLinkId}
                                onLinkClick={(linkId) => {
                                    setEditingLinkId(linkId);
                                    setShowAddForm(false);
                                }}
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



            {/* Form modal */}
            {editMode && (
                <LinkFormModal
                    isOpen={showAddForm || !!editingLinkId}
                    mode={editingLinkId ? 'edit' : 'create'}
                    editingLinkId={editingLinkId}
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSaveLink}
                    onSaveToLibrary={handleSaveToLibrary}
                    onDelete={handleDeleteLink}
                    onClose={resetForm}
                    libraryLinks={libraryLinks as LibraryLink[]}
                    onLibrarySelect={(link) => {
                        // Pre-fill form from library template
                        setFormData({
                            title: link.title || '',
                            icon: link.icon || 'Link',
                            size: link.size || 'circle',
                            type: link.type || 'link',
                            url: link.url || '',
                            showIcon: link.style?.showIcon !== false,
                            showText: link.style?.showText !== false,
                            action: link.action || { method: 'GET', url: '', headers: {}, body: null }
                        } as LinkFormData);
                    }}
                    onLibraryDelete={(linkId) => {
                        deleteLibraryLink.mutate(linkId);
                    }}
                />
            )}

            {/* Debug info removed - debugMode prop no longer used */}
        </div>
    );
};

export default LinkGridWidget;

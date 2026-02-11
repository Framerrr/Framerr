/**
 * AddWidgetModal - Modal for browsing and adding widgets to dashboard
 * 
 * Migrated to use shared WidgetCard + useWidgetData for consistency
 * with Widget Gallery. Supports both click-to-add and drag-and-drop.
 * 
 * GridStack handles external drag via data attributes on WidgetCard.
 * Modal auto-closes when widget is dragged out (detected by GridStack).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Modal, Select } from '../../../shared/ui';
import { WidgetCard, useWidgetData } from '../../../shared/widgets';
import { getWidgetsByCategory, WidgetMetadata } from '../../../widgets/registry';
import logger from '../../../utils/logger';

export interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddWidget: (widgetType: string) => Promise<void>;
}

/**
 * AddWidgetModal - Modal for browsing and adding widgets to dashboard
 * Uses shared WidgetCard component and useWidgetData hook
 */
const AddWidgetModal = ({
    isOpen,
    onClose,
    onAddWidget
}: AddWidgetModalProps): React.JSX.Element | null => {
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [adding, setAdding] = useState<string | null>(null);

    // Track if drag is in progress for modal visibility
    const isDraggingRef = useRef(false);

    // Use shared hook for integration/visibility logic
    const {
        loading,
        hasAdminAccess,
        integrations,
        fetchIntegrations,
        isWidgetVisible,
        getSharedByInfo
    } = useWidgetData();

    const widgetsByCategory = getWidgetsByCategory();
    const categories = ['all', ...Object.keys(widgetsByCategory)];

    // Detect when a drag starts via MutationObserver (GridStack adds .ui-draggable-dragging)
    useEffect(() => {
        if (!isOpen) return;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // Look for a new element with .ui-draggable-dragging class
                    for (const node of mutation.addedNodes) {
                        if (node instanceof HTMLElement && node.classList.contains('ui-draggable-dragging')) {
                            logger.debug('Widget drag started from modal, hiding portal');
                            isDraggingRef.current = true;

                            // Find and hide the modal's portal elements directly.
                            // Our Modal renders fixed z-[100] elements into body via Radix portal.
                            // We hide them with opacity:0 but keep DOM alive for touch events.
                            const portalElements: HTMLElement[] = [];
                            document.querySelectorAll('body > div').forEach(el => {
                                const htmlEl = el as HTMLElement;
                                const style = window.getComputedStyle(htmlEl);
                                if (style.position === 'fixed' && style.zIndex === '100') {
                                    portalElements.push(htmlEl);
                                    htmlEl.style.opacity = '0';
                                    htmlEl.style.pointerEvents = 'none';
                                    htmlEl.style.zIndex = '-1';
                                }
                            });

                            // Always close modal when drag ends — whether dropped on grid or not.
                            // Re-opening the modal is trivial, and trying to restore visibility
                            // causes z-index stacking issues.
                            const closeDragModal = () => {
                                isDraggingRef.current = false;
                                document.removeEventListener('mouseup', closeDragModal);
                                document.removeEventListener('touchend', closeDragModal);
                                onClose();
                            };
                            document.addEventListener('mouseup', closeDragModal as EventListener);
                            document.addEventListener('touchend', closeDragModal as EventListener);
                            return;
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [isOpen, onClose]);

    // Fetch integrations when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchIntegrations();
        }
    }, [isOpen, fetchIntegrations]);

    // Filter widgets based on search, category, and permissions
    const filteredWidgets = Object.entries(widgetsByCategory).reduce<Record<string, WidgetMetadata[]>>((acc, [category, widgets]) => {
        if (selectedCategory !== 'all' && selectedCategory !== category) {
            return acc;
        }

        const filtered = widgets.filter(widget => {
            // First check visibility (permissions)
            if (!isWidgetVisible(widget)) return false;

            // Then check search term
            return widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                widget.description.toLowerCase().includes(searchTerm.toLowerCase());
        });

        if (filtered.length > 0) {
            acc[category] = filtered;
        }

        return acc;
    }, {});

    const handleAddWidget = async (widgetType: string): Promise<void> => {
        setAdding(widgetType);
        try {
            await onAddWidget(widgetType);
        } catch (error) {
            logger.error('Failed to add widget', { error: (error as Error).message, modal: 'AddWidget' });
        } finally {
            setAdding(null);
        }
    };

    // Handle modal close - sync to parent
    const handleOpenChange = (open: boolean): void => {
        if (!open) {
            onClose();
        }
    };

    // Render modal with direct isOpen prop
    return (
        <Modal open={isOpen} onOpenChange={handleOpenChange} size="xl">
            <Modal.Header
                title={
                    <div>
                        <span className="text-xl font-bold text-theme-primary">Add Widget</span>
                        <p className="text-sm text-theme-secondary font-normal">Choose a widget to add to your dashboard</p>
                    </div>
                }
            />
            <Modal.Body>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-tertiary" size={18} />
                        <input
                            type="text"
                            placeholder="Search widgets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-theme-tertiary border border-theme rounded-lg text-theme-primary placeholder-theme-tertiary focus:outline-none focus:border-accent transition-all"
                        />
                    </div>

                    {/* Category Filter */}
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <Select.Trigger className="w-[180px]">
                            <Select.Value placeholder="All Categories" />
                        </Select.Trigger>
                        <Select.Content>
                            {categories.map(cat => (
                                <Select.Item key={cat} value={cat}>
                                    {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select>
                </div>

                {/* Widget Grid */}
                <div>
                    {loading ? (
                        <div className="text-center py-16 text-theme-tertiary">
                            <p>Loading widgets...</p>
                        </div>
                    ) : Object.keys(filteredWidgets).length === 0 ? (
                        <div className="text-center py-16 text-theme-tertiary">
                            <p>No widgets found matching your search.</p>
                        </div>
                    ) : (
                        Object.entries(filteredWidgets).map(([category, widgets]) => (
                            <div key={category} className="mb-8 last:mb-0">
                                <h3 className="text-lg font-semibold text-theme-primary mb-4 capitalize flex items-center gap-2">
                                    {category}
                                    <span className="text-sm text-theme-tertiary font-normal">({widgets.length})</span>
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {widgets.map(widget => (
                                        <WidgetCard
                                            key={widget.type}
                                            widget={widget}
                                            variant="modal"
                                            isAdding={adding === widget.type}
                                            hasAdminAccess={hasAdminAccess}
                                            integrations={integrations}
                                            onAdd={handleAddWidget}
                                            sharedBy={!hasAdminAccess ? (getSharedByInfo(widget) ?? undefined) : undefined}
                                            draggable
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Modal.Body>
            <Modal.Footer className="justify-center">
                <p className="text-xs text-theme-tertiary text-center">
                    💡 <span className="hidden sm:inline">Tip: </span>Click "Add to Dashboard" or drag widgets directly onto your dashboard
                </p>
            </Modal.Footer>
        </Modal>
    );
};

export default AddWidgetModal;

/**
 * TemplateBuilderStep2 - Grid Editor for template building
 * 
 * ARCHITECTURE: Uses useDashboardLayout as the single source of truth for:
 * - Widget state (add, delete, update)
 * - Layout state (positions, responsive layouts)
 * - Undo/redo history
 * - Mobile layout mode
 * 
 * This component only manages:
 * - Selection state (local, for config panel)
 * - Keyboard shortcuts (Ctrl+Z/Y)
 * - Widget sidebar and toolbar UI
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { LayoutGrid } from 'lucide-react';
import { useRoleAwareIntegrations } from '../../../api/hooks';
import { getWidgetsByCategory, getWidgetIcon, getWidgetMetadata, getPreviewWidget } from '../../../widgets/registry';
import { getMockWidget } from './mocks/MockWidgets';
import { WidgetRenderer } from '../../../shared/widgets/WidgetRenderer';
import { useWidgetData } from '../../../shared/widgets/hooks/useWidgetData';
import logger from '../../../utils/logger';
import type { TemplateData, TemplateWidget, ViewMode } from './types';
import '../../../styles/GridLayout.css';

// Import grid components and types from shared grid module
import { FramerrTemplateGrid } from '../../../shared/grid';

// Shared layout hook
import { useDashboardLayout } from '../../../hooks/useDashboardLayout';
import type { FramerrWidget } from '../../../hooks/useDashboardLayout';

// Extracted components
import { WidgetSidebar } from './components/WidgetSidebar';
import { MobileLayoutModeBar } from './components/MobileLayoutModeBar';
import { EditorToolbar } from './components/EditorToolbar';

// Grid configuration for new widgets and dimension calculations
import { GRID_COLS, GRID_MARGIN, ROW_HEIGHT } from '../../../constants/gridConfig';

// Virtual widths for scaled preview
const VIRTUAL_DESKTOP_WIDTH = 1200;
const VIRTUAL_MOBILE_WIDTH = 390;

interface Step2Props {
    data: TemplateData;
    onChange: (updates: Partial<TemplateData>) => void;
    onDraftSave?: (widgets?: TemplateWidget[]) => void;
    isAdmin?: boolean;
    onReady?: () => void;
    /** When true, shows read-only preview mode (Step 3 reuses this grid) */
    isPreviewMode?: boolean;
    /** Max height for grid area in pixels (used in preview mode for shorter grid) */
    maxGridHeight?: number;
}

/**
 * Generate simple widget ID matching dashboard pattern
 */
const generateWidgetId = (): string => `widget-${Date.now()}`;

// NOTE: Since TemplateWidget = FramerrWidget (Phase 1 consolidation),
// no conversion is needed. We pass widgets directly to useDashboardLayout.

/**
 * ScaledGridContainer - Wrapper that syncs its height with scaled content.
 * Uses ResizeObserver to track inner grid height and applies scale factor.
 */
interface ScaledGridContainerProps {
    virtualWidth: number;
    scaleFactor: number;
    children: React.ReactNode;
}

function ScaledGridContainer({ virtualWidth, scaleFactor, children }: ScaledGridContainerProps) {
    const innerRef = useRef<HTMLDivElement>(null);
    const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

    useEffect(() => {
        if (!innerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Get the actual content height and scale it
                const contentHeight = entry.contentRect.height;
                setScaledHeight(contentHeight * scaleFactor);
            }
        });

        observer.observe(innerRef.current);
        return () => observer.disconnect();
    }, [scaleFactor]);

    return (
        <div style={{ width: virtualWidth * scaleFactor, height: scaledHeight }}>
            <div
                ref={innerRef}
                data-grid-container="template-grid"
                style={{
                    width: virtualWidth,
                    transform: `scale(${scaleFactor})`,
                    transformOrigin: 'top left',
                    position: 'relative',
                }}
            >
                {children}
            </div>
        </div>
    );
}

const TemplateBuilderStep2: React.FC<Step2Props> = ({ data, onChange, onDraftSave, isAdmin = false, onReady, isPreviewMode = false, maxGridHeight }) => {
    // In preview mode, sidebar is always closed
    const [sidebarOpen, setSidebarOpen] = useState(!isPreviewMode);
    const [viewMode, setViewMode] = useState<ViewMode>('desktop');

    // Integration instance type for sharing selector (admin only)
    interface IntegrationInstance {
        id: string;
        name: string;
        type: string;
        displayName?: string;
    }

    // Get all available widgets
    const allWidgetsByCategory = useMemo(() => getWidgetsByCategory(), []);

    // Widget visibility filtering (non-admins only see shared widgets)
    const { isWidgetVisible } = useWidgetData();

    // Filter widgets based on user access
    const widgetsByCategory = useMemo(() => {
        const filtered: typeof allWidgetsByCategory = {};
        for (const [category, widgets] of Object.entries(allWidgetsByCategory)) {
            const visibleWidgets = widgets.filter(w => isWidgetVisible(w));
            if (visibleWidgets.length > 0) {
                filtered[category] = visibleWidgets;
            }
        }
        return filtered;
    }, [allWidgetsByCategory, isWidgetVisible]);

    // ========== SHARED LAYOUT HOOK ==========
    // Since TemplateWidget = FramerrWidget, pass directly (no conversion needed)
    const layoutHook = useDashboardLayout({
        initialWidgets: data.widgets,
        initialMobileWidgets: data.mobileWidgets || [],
        initialMobileLayoutMode: data.mobileLayoutMode || 'linked',
        isMobile: viewMode === 'mobile',
        onWidgetsChange: (newWidgets) => {
            // Pass directly - types are identical
            queueMicrotask(() => onChange({ widgets: newWidgets }));
        },
        onMobileWidgetsChange: (newMobileWidgets) => {
            queueMicrotask(() => onChange({ mobileWidgets: newMobileWidgets }));
        },
        onMobileLayoutModeChange: (mode) => {
            queueMicrotask(() => onChange({ mobileLayoutMode: mode }));
        },
    });

    const {
        layouts,
        mobileLayoutMode,
        displayWidgets,
        gridProps,
        addWidget,
        deleteWidget,
        updateWidgetConfig,
        setEditMode,
        toggleMobileLayoutMode,
        setInitialData,
        setViewBreakpoint,
        canUndo,
        canRedo,
        undo,
        redo,
    } = layoutHook;

    // ========== SELECTION STATE (Local to Template Builder) ==========
    const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

    // Computed values
    const isMobileCustomMode = viewMode === 'mobile' && mobileLayoutMode === 'independent';

    // Derive selected widget and index from ID
    const widgetsArray = isMobileCustomMode ? (data.mobileWidgets || []) : data.widgets;
    const selectedWidgetIndex = useMemo(() => {
        if (selectedWidgetId === null) return null;
        const index = widgetsArray.findIndex(w => w.id === selectedWidgetId);
        return index >= 0 ? index : null;
    }, [selectedWidgetId, widgetsArray]);
    const selectedWidget = selectedWidgetIndex !== null ? widgetsArray[selectedWidgetIndex] : undefined;

    // When on mobile in linked mode, disable undo/redo (nothing mobile-specific to undo)
    const isMobileLinkedMode = viewMode === 'mobile' && mobileLayoutMode === 'linked';
    const effectiveCanUndo = isMobileLinkedMode ? false : canUndo;
    const effectiveCanRedo = isMobileLinkedMode ? false : canRedo;

    // ========== WIDGET OPERATIONS (Wrappers for draft save) ==========
    const handleAddWidget = useCallback((
        widgetType: string,
        dropPosition?: { x: number; y: number; w?: number; h?: number; id?: string }
    ) => {
        const metadata = getWidgetMetadata(widgetType);
        if (!metadata) return;

        const newWidgetHeight = dropPosition?.h ?? metadata.defaultSize.h;
        const newWidgetWidth = dropPosition?.w ?? metadata.defaultSize.w;
        // Use ID from drop event if provided (keeps GridStack DOM in sync), otherwise generate new
        const stableId = dropPosition?.id ?? generateWidgetId();

        const newWidget: FramerrWidget = {
            id: stableId,
            type: widgetType,
            layout: {
                x: dropPosition?.x ?? 0,
                y: dropPosition?.y ?? 0,
                w: newWidgetWidth,
                h: newWidgetHeight
            },
            mobileLayout: {
                x: 0,
                y: dropPosition?.y ?? 0,
                w: GRID_COLS.sm,
                h: newWidgetHeight
            },
            config: { ...metadata.defaultConfig },
        };

        addWidget(newWidget);
        setTimeout(() => onDraftSave?.(), 50);
    }, [addWidget, onDraftSave]);

    const handleRemoveWidget = useCallback((widgetId: string) => {
        deleteWidget(widgetId);
        if (selectedWidgetId === widgetId) {
            setSelectedWidgetId(null);
        }
        setTimeout(() => onDraftSave?.(), 50);
    }, [deleteWidget, selectedWidgetId, onDraftSave]);

    const updateSelectedWidgetConfig = useCallback((updates: Partial<{ showHeader: boolean; flatten: boolean }>) => {
        if (selectedWidgetId === null) return;
        updateWidgetConfig(selectedWidgetId, updates);
        setTimeout(() => onDraftSave?.(), 50);
    }, [selectedWidgetId, updateWidgetConfig, onDraftSave]);

    // ========== KEYBOARD SHORTCUTS ==========
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if not in an input field
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }
            // ESC to deselect widget
            if (e.key === 'Escape') {
                setSelectedWidgetId(null);
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            }
            // Ctrl+Y for redo (Windows standard)
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // Track the last synced data to detect external changes
    const lastSyncedDataRef = useRef<string>(JSON.stringify(data.widgets));
    const lastSyncedMobileRef = useRef<string>(JSON.stringify(data.mobileWidgets || []));
    const lastSyncedModeRef = useRef<string>(data.mobileLayoutMode || 'linked');

    // Sync hook state when data changes from any external source
    useEffect(() => {
        const currentDataStr = JSON.stringify(data.widgets);
        const currentMobileStr = JSON.stringify(data.mobileWidgets || []);
        const currentMode = data.mobileLayoutMode || 'linked';

        const widgetsChanged = currentDataStr !== lastSyncedDataRef.current;
        const mobileChanged = currentMobileStr !== lastSyncedMobileRef.current;
        const modeChanged = currentMode !== lastSyncedModeRef.current;

        if (widgetsChanged || mobileChanged || modeChanged) {
            lastSyncedDataRef.current = currentDataStr;
            lastSyncedMobileRef.current = currentMobileStr;
            lastSyncedModeRef.current = currentMode;

            setInitialData({
                widgets: data.widgets,
                mobileWidgets: data.mobileWidgets || [],
                mobileLayoutMode: currentMode,
                preserveCache: true,
            });
        }
    }, [data.widgets, data.mobileWidgets, data.mobileLayoutMode, setInitialData]);

    // Keep hook in "edit mode" since template builder is always editing
    useEffect(() => {
        setEditMode(true);
    }, [setEditMode]);

    useEffect(() => {
        setViewBreakpoint(viewMode === 'mobile' ? 'sm' : 'lg');
    }, [viewMode, setViewBreakpoint]);

    // Signal ready after initial mount
    useEffect(() => {
        // Small delay to ensure hooks are settled
        const timer = setTimeout(() => onReady?.(), 50);
        return () => clearTimeout(timer);
    }, [onReady]);

    // Use cached integration data from React Query (already loaded)
    const { data: allIntegrations = [] } = useRoleAwareIntegrations();

    // Derive integration instances from cached data based on selected widget
    // FIX: Use correct widget array based on mobile customize mode
    const integrationInstances = useMemo((): IntegrationInstance[] => {
        if (!isAdmin || selectedWidgetId === null) return [];

        // Use the correct widget array based on current mode
        const widgetArray = isMobileCustomMode ? (data.mobileWidgets || []) : data.widgets;
        const widget = widgetArray.find(w => w.id === selectedWidgetId);
        if (!widget) return [];

        const metadata = getWidgetMetadata(widget.type);
        const compatibleTypes = metadata?.compatibleIntegrations || [];
        if (compatibleTypes.length === 0) return [];

        // Filter cached integrations by compatible types
        return allIntegrations
            .filter(int => compatibleTypes.includes(int.type))
            .map(int => ({
                id: int.id,
                name: int.displayName || int.name || int.type,
                type: int.type,
                displayName: int.displayName || int.name
            }));
    }, [isAdmin, selectedWidgetId, isMobileCustomMode, data.widgets, data.mobileWidgets, allIntegrations]);

    // Container measurement for scale calculation
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(800);

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };

        updateWidth();
        const resizeObserver = new ResizeObserver(updateWidth);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    // Calculate virtual width and scale factor
    const virtualWidth = viewMode === 'mobile' ? VIRTUAL_MOBILE_WIDTH : VIRTUAL_DESKTOP_WIDTH;
    const scaleFactor = Math.min(1, (containerWidth - 32) / virtualWidth);

    // Get current layout array for GridLayout
    const currentLayoutArray = useMemo(() => {
        const sourceLayout = viewMode === 'mobile' ? layouts.sm : layouts.lg;
        return sourceLayout || [];
    }, [viewMode, layouts]);

    // isEditable: Only allow editing on desktop, or mobile in independent mode
    // In preview mode, grid is always locked (static)
    const isEditable = !isPreviewMode && (viewMode === 'desktop' || isMobileCustomMode);
    const currentBreakpoint = viewMode === 'mobile' ? 'sm' as const : 'lg' as const;

    return (
        <div className={`flex flex-col h-full ${isPreviewMode ? '' : 'min-h-[400px]'}`}>
            {/* Toolbar - hidden in preview mode */}
            {!isPreviewMode && (
                <EditorToolbar
                    canUndo={effectiveCanUndo}
                    canRedo={effectiveCanRedo}
                    onUndo={undo}
                    onRedo={redo}
                    isEditable={isEditable}
                    selectedWidget={selectedWidget}
                    selectedWidgetIndex={selectedWidgetIndex}
                    onUpdateWidgetConfig={updateSelectedWidgetConfig}
                    isAdmin={isAdmin}
                    integrationInstances={integrationInstances}
                    data={data}
                    onChange={onChange}
                    onDraftSave={onDraftSave}
                    widgetCount={displayWidgets.length}
                    isMobileCustomMode={isMobileCustomMode}
                />
            )}

            {/* Mobile Layout Mode Toggle - always shown (for view switching) */}
            <MobileLayoutModeBar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                mobileLayoutMode={mobileLayoutMode}
                onToggle={isPreviewMode ? undefined : toggleMobileLayoutMode}
            />

            <div className={`flex ${isPreviewMode ? 'flex-shrink-0' : 'flex-1'} min-h-0 overflow-hidden rounded-b-lg border border-t-0 border-theme`}>
                {/* Widget Sidebar - hidden in preview mode */}
                {!isPreviewMode && (
                    <WidgetSidebar
                        isOpen={sidebarOpen}
                        onToggle={() => setSidebarOpen(!sidebarOpen)}
                        widgetsByCategory={widgetsByCategory}
                        onAddWidget={handleAddWidget}
                        disabled={!isEditable}
                    />
                )}

                <div
                    ref={containerRef}
                    className="relative flex-1 bg-theme-primary overflow-auto custom-scrollbar"
                    style={maxGridHeight ? { maxHeight: maxGridHeight } : undefined}
                >
                    {/* Empty State Overlay */}
                    {displayWidgets.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 pointer-events-none z-10">
                            <div className="p-4 rounded-full bg-theme-secondary mb-4 pointer-events-auto">
                                <LayoutGrid size={32} className="text-theme-tertiary" />
                            </div>
                            <h3 className="text-lg font-medium text-theme-primary mb-2">
                                Start building your template
                            </h3>
                            <p className="text-sm text-theme-secondary max-w-md">
                                Drag widgets from the sidebar to add them to your layout.
                            </p>
                        </div>
                    )}
                    {/* Grid - always rendered for drop target */}
                    {/* Let GridStack control height via min-height (set internally) */}
                    <div className="p-2 flex justify-center">
                        <ScaledGridContainer
                            virtualWidth={virtualWidth}
                            scaleFactor={scaleFactor}
                        >

                            <FramerrTemplateGrid
                                widgets={displayWidgets}
                                width={virtualWidth}
                                breakpoint={currentBreakpoint}
                                isEditable={isEditable}
                                transformScale={scaleFactor}
                                onLayoutCommit={gridProps.onLayoutCommit}
                                onDragStart={gridProps.onDragStart}
                                onResizeStart={gridProps.onResizeStart}
                                onExternalWidgetDrop={(event) => {
                                    handleAddWidget(event.widgetType, {
                                        x: event.x,
                                        y: event.y,
                                        w: event.w,
                                        h: event.h,
                                    });
                                }}
                                renderWidget={(widget: FramerrWidget) => {
                                    const Icon = getWidgetIcon(widget.type);
                                    const metadata = getWidgetMetadata(widget.type);
                                    // Find template widget by ID (stable lookup)
                                    const templateWidget = isMobileCustomMode
                                        ? data.mobileWidgets?.find(w => w.id === widget.id)
                                        : data.widgets.find(w => w.id === widget.id);
                                    const isLinkGrid = widget.type === 'link-grid';
                                    const showHeader = !isLinkGrid && templateWidget?.config?.showHeader !== false;

                                    // Use widget ID for stable selection
                                    const widgetIdForSelection = widget.id || `widget-${widget.id}`;
                                    const isSelected = selectedWidgetId === widgetIdForSelection;

                                    return (
                                        <div
                                            className={isSelected ? 'widget-selected' : ''}
                                            style={{ width: '100%', height: '100%' }}
                                            onMouseDown={() => isEditable && setSelectedWidgetId(widgetIdForSelection)}
                                            onTouchStart={() => isEditable && setSelectedWidgetId(widgetIdForSelection)}
                                        >
                                            <WidgetRenderer
                                                widget={{
                                                    ...widget,
                                                    config: templateWidget?.config || widget.config,
                                                }}
                                                mode="preview"
                                                title={metadata?.name || widget.type}
                                                icon={Icon}
                                                showHeader={showHeader}
                                                flatten={templateWidget?.config?.flatten as boolean}
                                                editMode={isEditable}
                                                onDelete={() => handleRemoveWidget(widgetIdForSelection)}
                                            >
                                                {(() => {
                                                    const PreviewWidget = getPreviewWidget(widget.type);
                                                    if (PreviewWidget) {
                                                        return (
                                                            <React.Suspense fallback={<div className="flex items-center justify-center h-full text-theme-tertiary">Loading...</div>}>
                                                                <PreviewWidget
                                                                    widget={{ id: widget.id, type: widget.type, layout: widget.layout, config: templateWidget?.config || {} }}
                                                                    previewMode={true}
                                                                    containerHeight={(() => {
                                                                        return widget.layout.h * ROW_HEIGHT - GRID_MARGIN[1];
                                                                    })()}
                                                                    containerWidth={(() => {
                                                                        const cols = viewMode === 'mobile' ? GRID_COLS.sm : GRID_COLS.lg;
                                                                        const colWidth = (virtualWidth - GRID_MARGIN[0] * 2) / cols;
                                                                        return widget.layout.w * colWidth - GRID_MARGIN[0];
                                                                    })()}
                                                                    transformScale={scaleFactor}
                                                                />
                                                            </React.Suspense>
                                                        );
                                                    }
                                                    const MockWidget = getMockWidget(widget.type);
                                                    return <MockWidget />;
                                                })()}
                                            </WidgetRenderer>
                                        </div>
                                    );
                                }}
                            />

                        </ScaledGridContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateBuilderStep2;

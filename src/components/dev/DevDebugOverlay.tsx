import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { FramerrWidget } from '../../../shared/types/widget';

/**
 * DevDebugOverlay - Draggable debug panel for DevDashboard
 * 
 * Features:
 * - Draggable anywhere on screen (native drag, no library)
 * - Position persists in localStorage
 * - Collapsible
 * - Shows all dashboard state for debugging
 */

interface DevDebugOverlayProps {
    // Dashboard state
    mobileLayoutMode: 'linked' | 'independent';
    pendingUnlink: boolean;
    currentBreakpoint: string;
    editMode: boolean;
    hasUnsavedChanges: boolean;
    isMobile: boolean;
    isUserDragging: boolean;

    // Layouts and widgets (using FramerrWidget[])
    widgets: FramerrWidget[];
    mobileWidgets: FramerrWidget[];
    layouts: {
        lg: Array<{ id: string; x: number; y: number; w: number; h: number }>;
        sm: Array<{ id: string; x: number; y: number; w: number; h: number }>;
    };
    widgetVisibility?: Record<string, boolean>;
    widgetPixelSizes?: Record<string, { w: number; h: number }>;
}

interface Position {
    x: number;
    y: number;
}

const STORAGE_KEY = 'dev-debug-overlay-position';
const OVERLAY_WIDTH = 300;
const OVERLAY_HEIGHT = 400;
const DEFAULT_POSITION: Position = { x: window.innerWidth - OVERLAY_WIDTH - 16, y: window.innerHeight - OVERLAY_HEIGHT - 16 };

const DevDebugOverlay: React.FC<DevDebugOverlayProps> = ({
    mobileLayoutMode,
    pendingUnlink,
    currentBreakpoint,
    editMode,
    hasUnsavedChanges,
    isMobile,
    isUserDragging,
    widgets,
    mobileWidgets,
    layouts,
    widgetVisibility = {},
    widgetPixelSizes = {}
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isOnDashboard, setIsOnDashboard] = useState(() => {
        const hash = window.location.hash.slice(1);
        return !hash || hash === 'dashboard' || hash.startsWith('dashboard?') || hash === 'dev/dashboard' || hash.startsWith('dev/dashboard?');
    });
    const [position, setPosition] = useState<Position>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Validate position is within viewport with proper bounds
                return {
                    x: Math.min(Math.max(0, parsed.x), window.innerWidth - OVERLAY_WIDTH),
                    y: Math.min(Math.max(0, parsed.y), window.innerHeight - (isCollapsed ? 50 : OVERLAY_HEIGHT))
                };
            }
        } catch {
            // Ignore parse errors
        }
        return DEFAULT_POSITION;
    });

    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Track hash changes to show/hide overlay
    useEffect(() => {
        const handleHashChange = (): void => {
            const hash = window.location.hash.slice(1);
            const onDashboard = !hash || hash === 'dashboard' || hash.startsWith('dashboard?') || hash === 'dev/dashboard' || hash.startsWith('dev/dashboard?');
            setIsOnDashboard(onDashboard);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Save position to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    }, [position]);

    // Mouse drag handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.no-drag')) return;

        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            posX: position.x,
            posY: position.y
        };
        e.preventDefault();
    }, [position]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !dragStartRef.current) return;

        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        const overlayHeight = isCollapsed ? 50 : OVERLAY_HEIGHT;

        setPosition({
            x: Math.min(Math.max(0, dragStartRef.current.posX + deltaX), window.innerWidth - OVERLAY_WIDTH),
            y: Math.min(Math.max(0, dragStartRef.current.posY + deltaY), window.innerHeight - overlayHeight)
        });
    }, [isDragging, isCollapsed]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        dragStartRef.current = null;
    }, []);

    // Global mouse event listeners for dragging
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
        return undefined;
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Touch drag handlers (for mobile)
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('.no-drag')) return;

        const touch = e.touches[0];
        setIsDragging(true);
        dragStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            posX: position.x,
            posY: position.y
        };
    }, [position]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging || !dragStartRef.current) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - dragStartRef.current.x;
        const deltaY = touch.clientY - dragStartRef.current.y;
        const overlayHeight = isCollapsed ? 50 : OVERLAY_HEIGHT;

        setPosition({
            x: Math.min(Math.max(0, dragStartRef.current.posX + deltaX), window.innerWidth - OVERLAY_WIDTH),
            y: Math.min(Math.max(0, dragStartRef.current.posY + deltaY), window.innerHeight - overlayHeight)
        });
    }, [isDragging, isCollapsed]);

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
        dragStartRef.current = null;
    }, []);

    // Global touch event listeners for dragging
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleTouchEnd);
            return () => {
                window.removeEventListener('touchmove', handleTouchMove);
                window.removeEventListener('touchend', handleTouchEnd);
            };
        }
        return undefined;
    }, [isDragging, handleTouchMove, handleTouchEnd]);

    // Get widgets to display based on mode
    const displayWidgets = mobileLayoutMode === 'independent' && isMobile ? mobileWidgets : widgets;
    const currentLayout = currentBreakpoint === 'sm' ? layouts.sm : layouts.lg;

    // Sort widgets by Y position for display
    const sortedWidgets = [...displayWidgets].sort((a, b) => {
        const aLayout = currentLayout.find(l => l.id === a.id);
        const bLayout = currentLayout.find(l => l.id === b.id);
        return (aLayout?.y ?? 0) - (bLayout?.y ?? 0);
    });

    const overlayContent = (
        <div
            ref={overlayRef}
            style={{
                position: 'fixed',
                right: window.innerWidth - position.x - OVERLAY_WIDTH,
                top: position.y,
                zIndex: 99999,
                width: isCollapsed ? 'auto' : '300px',
                maxHeight: isCollapsed ? 'auto' : '400px',
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#fff',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
            }}
        >
            {/* Header - DRAGGABLE (mouse + touch) */}
            <div
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                style={{
                    padding: '8px 12px',
                    borderBottom: isCollapsed ? 'none' : '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none'
                }}
            >
                <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>🔧 Debug Overlay</span>
                <button
                    className="no-drag"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '14px'
                    }}
                >
                    {isCollapsed ? '▼' : '▲'}
                </button>
            </div>

            {/* Content - collapsible, selectable for copying */}
            {!isCollapsed && (
                <div style={{ padding: '8px 12px', overflowY: 'auto', maxHeight: '350px', userSelect: 'text', cursor: 'text' }}>
                    {/* State section */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ color: '#888' }}>Mode: </span>
                            <span style={{
                                color: mobileLayoutMode === 'linked' ? '#60a5fa' : '#4ade80',
                                fontWeight: 'bold'
                            }}>
                                {mobileLayoutMode}
                            </span>
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ color: '#888' }}>Pending Unlink: </span>
                            <span style={{
                                color: pendingUnlink ? '#fb923c' : '#4ade80',
                                fontWeight: 'bold'
                            }}>
                                {pendingUnlink ? 'true' : 'false'}
                            </span>
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ color: '#888' }}>Breakpoint: </span>
                            <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>
                                {currentBreakpoint}
                            </span>
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ color: '#888' }}>Edit Mode: </span>
                            <span style={{
                                color: editMode ? '#fbbf24' : '#6b7280',
                                fontWeight: 'bold'
                            }}>
                                {editMode ? 'ON' : 'OFF'}
                            </span>
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ color: '#888' }}>Unsaved: </span>
                            <span style={{
                                color: hasUnsavedChanges ? '#f87171' : '#4ade80',
                                fontWeight: 'bold'
                            }}>
                                {hasUnsavedChanges ? 'true' : 'false'}
                            </span>
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ color: '#888' }}>isMobile: </span>
                            <span style={{ color: '#fff' }}>
                                {isMobile ? 'true' : 'false'}
                            </span>
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ color: '#888' }}>isUserDragging: </span>
                            <span style={{
                                color: isUserDragging ? '#22d3ee' : '#6b7280',
                                fontWeight: 'bold'
                            }}>
                                {isUserDragging ? 'true' : 'false'}
                            </span>
                        </div>
                    </div>

                    {/* Widget list */}
                    <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                        <div style={{ color: '#888', marginBottom: '6px', fontWeight: 'bold' }}>
                            Widgets ({sortedWidgets.length}):
                        </div>
                        <div style={{ fontSize: '10px' }}>
                            {sortedWidgets.map((widget, idx) => {
                                const smLayout = layouts.sm.find(l => l.id === widget.id);
                                const lgLayout = layouts.lg.find(l => l.id === widget.id);
                                return (
                                    <div
                                        key={widget.id}
                                        style={{
                                            padding: '4px 6px',
                                            marginBottom: '2px',
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <span style={{ color: '#e0e0e0' }}>
                                            {idx + 1}. {widget.type}
                                            <span style={{
                                                marginLeft: '4px',
                                                color: widgetVisibility[widget.id] === false ? '#f87171' : '#4ade80',
                                                fontWeight: 'bold'
                                            }}>
                                                {widgetVisibility[widget.id] === false ? '👁️‍🗨️' : '👁️'}
                                            </span>
                                        </span>
                                        <span style={{ color: '#888', fontSize: '9px' }}>
                                            {currentBreakpoint === 'sm'
                                                ? `w:${smLayout?.w ?? '?'} h:${smLayout?.h ?? '?'}`
                                                : `w:${lgLayout?.w ?? '?'} h:${lgLayout?.h ?? '?'}`}
                                            {widgetPixelSizes[widget.id] && (
                                                <span style={{ color: '#22d3ee', marginLeft: '4px' }}>
                                                    ({widgetPixelSizes[widget.id].w}×{widgetPixelSizes[widget.id].h}px)
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Don't render if not on dashboard
    if (!isOnDashboard) {
        return null;
    }

    // Render via portal to avoid grid interference
    return createPortal(overlayContent, document.body);
};

export default DevDebugOverlay;

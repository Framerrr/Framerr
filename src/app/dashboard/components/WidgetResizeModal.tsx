/**
 * WidgetResizeModal - Manual widget sizing and positioning
 * 
 * Opened from WidgetActionsPopover "Move & Resize" button.
 * Allows precise numeric input for X, Y, W, H with validation
 * against widget min/max constraints.
 * 
 * Saves to dirty dashboard state only - cancel edit will revert.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from '../../../shared/ui';
import { getWidgetMetadata, getWidgetIcon, getWidgetConfigConstraints } from '../../../widgets/registry';
import { Move } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface WidgetResizeModalProps {
    isOpen: boolean;
    onClose: () => void;
    widgetId: string;
    widgetType: string;
    widgetName: string;
    currentLayout: { x: number; y: number; w: number; h: number };
    currentShowHeader?: boolean; // For bidirectional sync
    isMobile: boolean;
    onSave: (widgetId: string, layout: { x: number; y: number; w: number; h: number }) => void;
    onConfigUpdate?: (widgetId: string, config: Record<string, unknown>) => void;
}

type FieldKey = 'x' | 'y' | 'w' | 'h';

// ============================================================================
// Component
// ============================================================================

const WidgetResizeModal: React.FC<WidgetResizeModalProps> = ({
    isOpen,
    onClose,
    widgetId,
    widgetType,
    widgetName,
    currentLayout,
    currentShowHeader,
    isMobile,
    onSave,
    onConfigUpdate
}) => {
    // Local form state
    const [x, setX] = useState(currentLayout.x);
    const [y, setY] = useState(currentLayout.y);
    const [w, setW] = useState(currentLayout.w);
    const [h, setH] = useState(currentLayout.h);

    // Track which fields have been blurred (touched)
    const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
        x: false, y: false, w: false, h: false
    });

    // Get widget constraints
    const metadata = useMemo(() => getWidgetMetadata(widgetType), [widgetType]);
    const WidgetIcon = useMemo(() => getWidgetIcon(widgetType), [widgetType]);

    // Grid constraints based on breakpoint
    const maxCols = isMobile ? 4 : 24;

    // Widget-specific min/max (fallback to sensible defaults)
    const minW = metadata?.minSize?.w ?? 1;
    const maxW = metadata?.maxSize?.w ?? maxCols;
    const minH = metadata?.minSize?.h ?? 1;
    const maxH = metadata?.maxSize?.h ?? 20;

    // Reset form when modal opens with new layout
    useEffect(() => {
        if (isOpen) {
            setX(currentLayout.x);
            setY(currentLayout.y);
            setW(currentLayout.w);
            setH(currentLayout.h);
            setTouched({ x: false, y: false, w: false, h: false });
        }
    }, [isOpen, currentLayout]);

    // Per-field validation
    const fieldErrors = useMemo(() => {
        const errors: Record<FieldKey, boolean> = {
            x: x < 0 || x + w > maxCols,
            y: y < 0,
            w: w < minW || w > Math.min(maxW, maxCols),
            h: h < minH || h > maxH,
        };
        return errors;
    }, [x, y, w, h, minW, maxW, minH, maxH, maxCols]);

    const isValid = !Object.values(fieldErrors).some(Boolean);

    const handleBlur = useCallback((field: FieldKey) => {
        setTouched(prev => ({ ...prev, [field]: true }));
    }, []);

    const handleSave = () => {
        if (!isValid) return;
        onSave(widgetId, { x, y, w, h });

        // Bidirectional sync: if hard mode and height changed, update showHeader
        const constraints = getWidgetConfigConstraints(widgetType);
        if (constraints.headerHeightMode === 'hard' && onConfigUpdate) {
            const threshold = constraints.minHeightForHeader ?? 2;
            const newShowHeader = h >= threshold;
            // Only update if changed
            if (newShowHeader !== (currentShowHeader !== false)) {
                onConfigUpdate(widgetId, { showHeader: newShowHeader });
            }
        }

        onClose();
    };

    // Input field component with inline validation
    const NumberField = ({
        fieldKey,
        label,
        value,
        onChange,
    }: {
        fieldKey: FieldKey;
        label: string;
        value: number;
        onChange: (val: number) => void;
    }) => {
        const hasError = touched[fieldKey] && fieldErrors[fieldKey];

        return (
            <div className="flex flex-col gap-1.5">
                <label className={`text-xs font-medium uppercase tracking-wide flex items-center gap-2
                    ${hasError ? 'text-error' : 'text-theme-secondary'}`}>
                    <span>{label}</span>
                    {hasError && <span className="text-error normal-case">Invalid</span>}
                </label>
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
                    onBlur={() => handleBlur(fieldKey)}
                    className={`w-full px-3 py-2.5 rounded-lg bg-theme-tertiary 
                        text-theme-primary text-center font-mono text-lg
                        focus:outline-none focus:ring-2 transition-all
                        ${hasError
                            ? 'border-2 border-error focus:ring-error/50 focus:border-error'
                            : 'border border-theme focus:ring-accent/50 focus:border-accent'
                        }`}
                />
            </div>
        );
    };

    return (
        <Modal open={isOpen} onOpenChange={(open) => !open && onClose()} size="sm">
            <Modal.Header
                icon={<Move size={18} className="text-accent" />}
                title={
                    <span className="flex items-center gap-2">
                        <WidgetIcon size={16} className="text-theme-secondary" />
                        Move & Resize
                    </span>
                }
                subtitle={widgetName}
            />
            <Modal.Body>
                <div className="space-y-5">
                    {/* Position Section */}
                    <div>
                        <h4 className="text-sm font-medium text-theme-secondary mb-3">Position</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <NumberField fieldKey="x" label={`X (0-${maxCols - w})`} value={x} onChange={setX} />
                            <NumberField fieldKey="y" label="Y (Row)" value={y} onChange={setY} />
                        </div>
                    </div>

                    {/* Size Section */}
                    <div>
                        <h4 className="text-sm font-medium text-theme-secondary mb-3">Size</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <NumberField fieldKey="w" label={`Width (${minW}-${Math.min(maxW, maxCols)})`} value={w} onChange={setW} />
                            <NumberField fieldKey="h" label={`Height (${minH}-${maxH})`} value={h} onChange={setH} />
                        </div>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-theme-tertiary text-theme-primary hover:bg-theme-hover transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!isValid}
                    className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Apply
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default WidgetResizeModal;

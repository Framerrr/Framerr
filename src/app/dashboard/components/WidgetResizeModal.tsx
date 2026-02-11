/**
 * WidgetResizeModal - Manual widget sizing and positioning
 * 
 * Opened from WidgetActionsPopover "Move & Resize" button.
 * Allows precise numeric input for X, Y, W, H with:
 * - Stepper buttons (−/+) flanking each input
 * - Immediate validation (errors show on every change, not blur)
 * - Constraint-aware disabled states on steppers
 * 
 * Saves to dirty dashboard state only - cancel edit will revert.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from '../../../shared/ui';
import { getWidgetMetadata, getWidgetIcon, getWidgetConfigConstraints } from '../../../widgets/registry';
import { Move, Minus, Plus } from 'lucide-react';

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
// Stepper Field Component
// ============================================================================

interface StepperFieldProps {
    label: string;
    value: number;
    onChange: (val: number) => void;
    min: number;
    max: number;
    hasError: boolean;
}

const StepperField: React.FC<StepperFieldProps> = ({
    label,
    value,
    onChange,
    min,
    max,
    hasError,
}) => {
    const atMin = value <= min;
    const atMax = value >= max;

    const handleDecrement = () => {
        if (!atMin) onChange(value - 1);
    };

    const handleIncrement = () => {
        if (!atMax) onChange(value + 1);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        // Allow empty field while typing
        if (raw === '' || raw === '-') {
            onChange(0);
            return;
        }
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed)) {
            onChange(parsed);
        }
    };

    return (
        <div className="flex flex-col gap-1.5">
            <label className={`text-xs font-medium uppercase tracking-wide flex items-center justify-between
                ${hasError ? 'text-error' : 'text-theme-secondary'}`}>
                <span>{label}</span>
                {hasError && <span className="text-error normal-case text-[10px]">Invalid</span>}
            </label>
            <div className="flex items-stretch rounded-lg overflow-hidden border border-theme">
                {/* Decrement button */}
                <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={atMin}
                    className={`
                        flex items-center justify-center w-11 
                        bg-theme-tertiary text-theme-secondary
                        transition-colors
                        ${atMin
                            ? 'opacity-30 cursor-not-allowed'
                            : 'hover:bg-theme-hover hover:text-theme-primary active:bg-accent/20'}
                    `}
                    aria-label={`Decrease ${label}`}
                >
                    <Minus size={14} />
                </button>

                {/* Number input */}
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={value}
                    onChange={handleInputChange}
                    className={`
                        flex-1 min-w-0 px-2 py-2.5 
                        bg-theme-secondary text-theme-primary 
                        text-center font-mono text-lg
                        border-x border-theme
                        focus:outline-none focus:bg-theme-tertiary
                        transition-colors
                        ${hasError ? 'text-error' : ''}
                    `}
                />

                {/* Increment button */}
                <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={atMax}
                    className={`
                        flex items-center justify-center w-11
                        bg-theme-tertiary text-theme-secondary
                        transition-colors
                        ${atMax
                            ? 'opacity-30 cursor-not-allowed'
                            : 'hover:bg-theme-hover hover:text-theme-primary active:bg-accent/20'}
                    `}
                    aria-label={`Increase ${label}`}
                >
                    <Plus size={14} />
                </button>
            </div>
        </div>
    );
};

// ============================================================================
// Main Component
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

    // Get widget constraints
    const metadata = useMemo(() => getWidgetMetadata(widgetType), [widgetType]);
    const WidgetIcon = useMemo(() => getWidgetIcon(widgetType), [widgetType]);

    // Grid constraints based on breakpoint
    const maxCols = isMobile ? 4 : 24;

    // Widget-specific min/max (fallback to sensible defaults)
    const minW = metadata?.minSize?.w ?? 1;
    const maxW = Math.min(metadata?.maxSize?.w ?? maxCols, maxCols);
    const minH = metadata?.minSize?.h ?? 1;
    const maxH = metadata?.maxSize?.h ?? 20;

    // Reset form when modal opens with new layout
    useEffect(() => {
        if (isOpen) {
            setX(currentLayout.x);
            setY(currentLayout.y);
            setW(currentLayout.w);
            setH(currentLayout.h);
        }
    }, [isOpen, currentLayout]);

    // Immediate per-field validation
    const fieldErrors = useMemo((): Record<FieldKey, boolean> => ({
        x: x < 0 || x + w > maxCols,
        y: y < 0,
        w: w < minW || w > maxW,
        h: h < minH || h > maxH,
    }), [x, y, w, h, minW, maxW, minH, maxH, maxCols]);

    const isValid = !Object.values(fieldErrors).some(Boolean);

    // When W changes, auto-adjust X if it would push widget out of bounds
    const handleWChange = useCallback((newW: number) => {
        setW(newW);
        if (x + newW > maxCols) {
            setX(Math.max(0, maxCols - newW));
        }
    }, [x, maxCols]);

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
                            <StepperField
                                label={`X (col)`}
                                value={x}
                                onChange={setX}
                                min={0}
                                max={maxCols - w}
                                hasError={fieldErrors.x}
                            />
                            <StepperField
                                label="Y (row)"
                                value={y}
                                onChange={setY}
                                min={0}
                                max={999}
                                hasError={fieldErrors.y}
                            />
                        </div>
                    </div>

                    {/* Size Section */}
                    <div>
                        <h4 className="text-sm font-medium text-theme-secondary mb-3">Size</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <StepperField
                                label={`Width (${minW}-${maxW})`}
                                value={w}
                                onChange={handleWChange}
                                min={minW}
                                max={maxW}
                                hasError={fieldErrors.w}
                            />
                            <StepperField
                                label={`Height (${minH}-${maxH})`}
                                value={h}
                                onChange={setH}
                                min={minH}
                                max={maxH}
                                hasError={fieldErrors.h}
                            />
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

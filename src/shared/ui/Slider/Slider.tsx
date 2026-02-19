/**
 * Slider Primitive
 * 
 * Custom range slider with fluid dragging (iOS-style).
 * Renders as div-based track + thumb with pointer events for full visual control.
 * 
 * @example
 * <Slider value={7} min={1} max={30} onChange={setDays} />
 * <Slider value={50} min={0} max={100} label="Volume" />
 */

import React, { useRef, useCallback, useState } from 'react';

// ===========================
// Slider Component
// ===========================

export interface SliderProps {
    /** Current value */
    value: number;
    /** Minimum value */
    min?: number;
    /** Maximum value */
    max?: number;
    /** Step size — controls the granularity of snapping. Defaults to 1. Use 0.1 for truly fluid. */
    step?: number;
    /** Called on every value change (during drag) */
    onChange?: (value: number) => void;
    /** Called when drag ends (committed value) */
    onChangeEnd?: (value: number) => void;
    /** Disable the slider */
    disabled?: boolean;
    /** Additional class for the root container */
    className?: string;
    /** Accessible name */
    'aria-label'?: string;
}

export const Slider: React.FC<SliderProps> = ({
    value,
    min = 0,
    max = 100,
    step = 1,
    onChange,
    onChangeEnd,
    disabled = false,
    className = '',
    ...props
}) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Clamp and snap value to step
    const clampAndSnap = useCallback((rawValue: number): number => {
        const clamped = Math.min(max, Math.max(min, rawValue));
        if (step <= 0) return clamped;
        return Math.round(clamped / step) * step;
    }, [min, max, step]);

    // Convert pointer X position to value
    const positionToValue = useCallback((clientX: number): number => {
        const track = trackRef.current;
        if (!track) return value;
        const rect = track.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        return clampAndSnap(min + ratio * (max - min));
    }, [min, max, value, clampAndSnap]);

    // Pointer event handlers
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (disabled) return;
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setIsDragging(true);
        const newValue = positionToValue(e.clientX);
        onChange?.(newValue);
    }, [disabled, positionToValue, onChange]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging || disabled) return;
        const newValue = positionToValue(e.clientX);
        onChange?.(newValue);
    }, [isDragging, disabled, positionToValue, onChange]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        setIsDragging(false);
        const finalValue = positionToValue(e.clientX);
        onChange?.(finalValue);
        onChangeEnd?.(finalValue);
    }, [isDragging, positionToValue, onChange, onChangeEnd]);

    // Calculate fill percentage
    const range = max - min;
    const fillPercent = range > 0 ? ((value - min) / range) * 100 : 0;

    return (
        <div
            ref={trackRef}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            className={`
                relative w-full h-6 flex items-center select-none touch-none
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${className}
            `}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            {...props}
        >
            {/* Track background */}
            <div className="absolute left-0 right-0 h-1.5 rounded-full bg-theme-tertiary" />

            {/* Filled track */}
            <div
                className="absolute left-0 h-1.5 rounded-full"
                style={{
                    width: `${fillPercent}%`,
                    background: 'var(--accent)',
                }}
            />

            {/* Thumb */}
            <div
                className={`
                    absolute w-4.5 h-4.5 rounded-full
                    transition-shadow duration-150
                    ${isDragging ? 'scale-110' : ''}
                `}
                style={{
                    left: `calc(${fillPercent}% - 9px)`,
                    background: 'var(--accent)',
                    boxShadow: isDragging
                        ? '0 0 0 4px var(--accent-alpha-20, rgba(var(--accent-rgb, 99,102,241), 0.2)), 0 1px 3px rgba(0,0,0,0.3)'
                        : '0 1px 3px rgba(0,0,0,0.3)',
                }}
            />
        </div>
    );
};

Slider.displayName = 'Slider';

export default Slider;

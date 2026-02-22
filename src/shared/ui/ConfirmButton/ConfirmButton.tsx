/**
 * ConfirmButton Primitive
 * 
 * Smart width-stable inline confirm button with pop in/out animation.
 * 
 * WIDTH STABILITY:
 * The container width is determined by whichever state needs more space:
 * - Trigger text vs Confirm+Cancel content
 * - Both states always maintain the same width (no layout shift)
 * - Confirm/Cancel buttons always split 50/50
 * 
 * SMART DEFAULTS:
 * - confirmMode="auto": System decides icon vs text based on what fits
 * - confirmMode="icon": Force ✓ ✗ icons (useful for compact triggers)
 * - confirmMode="text": Force text labels (trigger expands to fit)
 * 
 * OVERRIDE BEHAVIOR:
 * - Set forceWidth to constrain size (content truncates if needed)
 * - Truncation applies to whichever state doesn't fit
 * 
 * @example
 * // Minimal - system decides everything (width-stable)
 * <ConfirmButton onConfirm={fn} label="Delete" />
 * 
 * @example
 * // Force icons for confirm (trigger defines width)
 * <ConfirmButton onConfirm={fn} label="Revoke All" confirmMode="icon" />
 * 
 * @example
 * // Force text labels (container expands to fit both)
 * <ConfirmButton onConfirm={fn} label="Delete" confirmMode="text" />
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, X, Check } from 'lucide-react';
import { buttonSizeClasses } from '../Button';

// ===========================
// Types
// ===========================

export type ConfirmButtonSize = 'sm' | 'md' | 'lg';
export type ConfirmMode = 'auto' | 'icon' | 'text' | 'iconOnly';
export type CancelPosition = 'left' | 'right';
export type AnchorButton = 'confirm' | 'cancel';
export type ExpandDirection = 'left' | 'right';

export interface ConfirmButtonProps {
    /** Called when user confirms the action */
    onConfirm: () => void;
    /** Called when confirming state changes (useful for hiding sibling elements) */
    onConfirmingChange?: (isConfirming: boolean) => void;
    /** Trigger button text */
    label?: string;
    /** Confirm button text (used in text mode) */
    confirmLabel?: string;
    /** Cancel button text (used in text mode) */
    cancelLabel?: string;
    /** Disable the button */
    disabled?: boolean;
    /** Button size preset - affects padding, text size, icon size */
    size?: ConfirmButtonSize;
    /** Text size - if not specified, scales with button size */
    textSize?: 'sm' | 'base' | 'lg';
    /** 
     * Confirm button display mode:
     * - 'auto': System decides based on available space (default)
     * - 'icon': Always show ✓ ✗ icons only (width-stable)
     * - 'text': Always show text labels
     * - 'iconOnly': Icon-only trigger, expands to show ✓ ✗ icons
     */
    confirmMode?: ConfirmMode;
    /** Position of cancel button relative to confirm ('left' or 'right') */
    cancelPosition?: CancelPosition;
    /** Whether to show the trash icon on trigger button (default true) */
    showTriggerIcon?: boolean;
    /** 
     * For iconOnly mode: which button stays at the trigger position
     * - 'cancel': Cancel stays at P, confirm appears (default)
     * - 'confirm': Confirm stays at P, cancel appears
     */
    anchorButton?: AnchorButton;
    /**
     * For iconOnly mode: direction the non-anchored button expands from
     * - 'left': Expands to the left of anchor
     * - 'right': Expands to the right of anchor
     */
    expandDirection?: ExpandDirection;
    /** Force a specific width (causes truncation if content doesn't fit) */
    forceWidth?: number | string;
    /** Additional CSS classes for the container */
    className?: string;
}

// ===========================
// Animation Variants
// ===========================

const popVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { type: 'spring' as const, stiffness: 500, damping: 30 },
    },
    exit: {
        opacity: 0,
        scale: 0.9,
        transition: { duration: 0.1 },
    },
};

// ===========================
// Size Classes
// ===========================

const sizeClasses = {
    sm: {
        height: buttonSizeClasses.sm.height,
        padding: buttonSizeClasses.sm.padding,
        text: buttonSizeClasses.sm.text,
        gap: buttonSizeClasses.sm.gap,
        iconSize: buttonSizeClasses.sm.iconSize,
    },
    md: {
        height: buttonSizeClasses.md.height,
        padding: buttonSizeClasses.md.padding,
        text: buttonSizeClasses.md.text,
        gap: buttonSizeClasses.md.gap,
        iconSize: buttonSizeClasses.md.iconSize,
    },
    lg: {
        height: buttonSizeClasses.lg.height,
        padding: buttonSizeClasses.lg.padding,
        text: buttonSizeClasses.lg.text,
        gap: buttonSizeClasses.lg.gap,
        iconSize: buttonSizeClasses.lg.iconSize,
    },
} as const;

// ===========================
// Component
// ===========================

export function ConfirmButton({
    onConfirm,
    onConfirmingChange,
    label = 'Delete',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    disabled = false,
    size = 'md',
    textSize,
    confirmMode = 'auto',
    cancelPosition = 'right',
    showTriggerIcon = true,
    anchorButton = 'cancel',
    expandDirection = 'left',
    forceWidth,
    className = '',
}: ConfirmButtonProps) {
    const [isConfirming, setIsConfirming] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const styles = sizeClasses[size];
    // Use explicit textSize if provided, otherwise scale with button size
    const textClass = textSize ? `text-${textSize}` : styles.text;

    // Determine mode
    const useIconOnlyMode = confirmMode === 'iconOnly';
    const useIconMode = confirmMode === 'icon' || (confirmMode === 'auto');
    const useTextMode = confirmMode === 'text';

    // Click outside to cancel
    useEffect(() => {
        if (!isConfirming) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsConfirming(false);
                onConfirmingChange?.(false);
            }
        };

        const timer = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isConfirming, onConfirmingChange]);

    const handleTrigger = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsConfirming(true);
        onConfirmingChange?.(true);
    };

    const handleConfirm = (e: React.MouseEvent) => {
        e.stopPropagation();
        onConfirm();
        setIsConfirming(false);
        onConfirmingChange?.(false);
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsConfirming(false);
        onConfirmingChange?.(false);
    };

    // Button base classes
    const buttonBaseClass = `
        inline-flex items-center justify-center
        rounded-lg font-medium
        transition-colors overflow-hidden
        ${styles.height} ${styles.padding} ${textClass} ${styles.gap}
    `;

    // Trigger button styling
    const triggerClass = `
        ${buttonBaseClass}
        bg-red-500/15 text-red-500
        hover:bg-red-500/25
        disabled:opacity-50 disabled:cursor-not-allowed
    `;

    // Confirm button styling
    const confirmClass = `
        ${buttonBaseClass}
        bg-red-500 text-white
        hover:bg-red-600
        min-w-0
    `;

    // Cancel button styling
    const cancelClass = `
        ${buttonBaseClass}
        bg-theme-tertiary text-theme-primary
        hover:bg-theme-hover
        min-w-0
    `;

    // Container style with optional forced width
    const containerStyle: React.CSSProperties = forceWidth
        ? { width: typeof forceWidth === 'number' ? `${forceWidth}px` : forceWidth }
        : {};

    // Render confirm/cancel buttons based on mode
    const ConfirmBtn = (
        <motion.button
            key="confirm"
            variants={popVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            type="button"
            onClick={handleConfirm}
            className={`${confirmClass} flex-1`}
            title={useIconMode ? confirmLabel : undefined}
        >
            <Check size={styles.iconSize} className="flex-shrink-0" />
            {useTextMode && <span className="truncate">{confirmLabel}</span>}
        </motion.button>
    );

    const CancelBtn = (
        <motion.button
            key="cancel"
            variants={popVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            type="button"
            onClick={handleCancel}
            className={`${cancelClass} flex-1`}
            title={useIconMode ? cancelLabel : undefined}
        >
            <X size={styles.iconSize} className="flex-shrink-0" />
            {useTextMode && <span className="truncate">{cancelLabel}</span>}
        </motion.button>
    );

    // ===========================
    // ICON-ONLY MODE RENDERING
    // Square buttons, anchored expansion
    // ===========================
    if (useIconOnlyMode) {
        // Height-based square size for iconOnly mode
        const squareSize = size === 'sm' ? 'w-7 h-7' : size === 'md' ? 'w-9 h-9' : 'w-11 h-11';

        const iconOnlyButtonBase = `
            inline-flex items-center justify-center
            rounded-lg transition-colors
            ${squareSize}
        `;

        const iconOnlyTrigger = `
            ${iconOnlyButtonBase}
            bg-red-500/15 text-red-500
            hover:text-red-400
            disabled:opacity-50 disabled:cursor-not-allowed
        `;

        const iconOnlyConfirm = `
            ${iconOnlyButtonBase}
            bg-red-500/15 text-red-500
            hover:text-red-400
        `;

        const iconOnlyCancel = `
            ${iconOnlyButtonBase}
            bg-theme-tertiary text-theme-tertiary
            hover:text-theme-primary
        `;

        // Determine flex direction based on anchor and expand direction
        // If cancel is anchor and expand is left: confirm is on left, cancel on right
        // If cancel is anchor and expand is right: cancel on left, confirm on right
        const confirmFirst =
            (anchorButton === 'cancel' && expandDirection === 'left') ||
            (anchorButton === 'confirm' && expandDirection === 'right');

        // Justify based on which side should be anchored
        const justifyClass =
            (anchorButton === 'cancel' && expandDirection === 'left') ? 'justify-end' :
                (anchorButton === 'cancel' && expandDirection === 'right') ? 'justify-start' :
                    (anchorButton === 'confirm' && expandDirection === 'left') ? 'justify-end' :
                        'justify-start';

        return (
            <div
                ref={containerRef}
                className={`inline-flex items-center ${justifyClass} gap-1 ${className}`}
            >
                <AnimatePresence mode="popLayout">
                    {!isConfirming ? (
                        // TRIGGER: Single icon button
                        <motion.button
                            key="trigger"
                            initial={{ opacity: 1, scale: 1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
                            type="button"
                            onClick={handleTrigger}
                            disabled={disabled}
                            className={iconOnlyTrigger}
                            title={label || 'Delete'}
                        >
                            <Trash2 size={styles.iconSize} />
                        </motion.button>
                    ) : confirmFirst ? (
                        // Confirm on left, Cancel on right
                        [
                            <motion.button
                                key="confirm"
                                variants={popVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                type="button"
                                onClick={handleConfirm}
                                className={iconOnlyConfirm}
                                title={confirmLabel}
                            >
                                <Check size={styles.iconSize} />
                            </motion.button>,
                            <motion.button
                                key="cancel"
                                variants={popVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                type="button"
                                onClick={handleCancel}
                                className={iconOnlyCancel}
                                title={cancelLabel}
                            >
                                <X size={styles.iconSize} />
                            </motion.button>
                        ]
                    ) : (
                        // Cancel on left, Confirm on right
                        [
                            <motion.button
                                key="cancel"
                                variants={popVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                type="button"
                                onClick={handleCancel}
                                className={iconOnlyCancel}
                                title={cancelLabel}
                            >
                                <X size={styles.iconSize} />
                            </motion.button>,
                            <motion.button
                                key="confirm"
                                variants={popVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                type="button"
                                onClick={handleConfirm}
                                className={iconOnlyConfirm}
                                title={confirmLabel}
                            >
                                <Check size={styles.iconSize} />
                            </motion.button>
                        ]
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // ===========================
    // STANDARD MODE RENDERING
    // Width-stable with measuring layer
    // ===========================
    return (
        <div
            ref={containerRef}
            className={`relative inline-block ${className}`}
            style={containerStyle}
        >
            {/* ===========================
                MEASURING LAYER (Sets Container Width)
                Uses visibility:hidden so it takes up space but isn't seen
                ========================== */}
            <div className="invisible flex gap-1" aria-hidden="true">
                {/* Trigger measurement - this sets minimum width */}
                <div className={`${buttonBaseClass} whitespace-nowrap`}>
                    {showTriggerIcon && <Trash2 size={styles.iconSize} />}
                    {label && <span>{label}</span>}
                </div>
            </div>
            {useTextMode && (
                <div className="invisible flex gap-1" aria-hidden="true">
                    {/* Confirm+Cancel text measurement - may be wider */}
                    <div className={`${buttonBaseClass} whitespace-nowrap flex-1`}>
                        <Check size={styles.iconSize} />
                        <span>{confirmLabel}</span>
                    </div>
                    <div className={`${buttonBaseClass} whitespace-nowrap flex-1`}>
                        <X size={styles.iconSize} />
                        <span>{cancelLabel}</span>
                    </div>
                </div>
            )}

            {/* ===========================
                VISIBLE LAYER (Overlays the measuring layer)
                Uses absolute positioning to fill container
                ========================== */}
            <div className="absolute inset-0 grid grid-cols-2 gap-1">
                <AnimatePresence mode="popLayout">
                    {!isConfirming ? (
                        // TRIGGER STATE: Button spans both columns
                        <motion.button
                            key="trigger"
                            initial={{ opacity: 1, scale: 1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.08 } }}
                            type="button"
                            onClick={handleTrigger}
                            disabled={disabled}
                            className={`${triggerClass} col-span-2`}
                            title={!label ? 'Delete' : undefined}
                        >
                            {showTriggerIcon && <Trash2 size={styles.iconSize} className="flex-shrink-0" />}
                            {label && <span className="truncate">{label}</span>}
                        </motion.button>
                    ) : cancelPosition === 'left' ? (
                        // CONFIRM STATE: Cancel on left
                        [CancelBtn, ConfirmBtn]
                    ) : (
                        // CONFIRM STATE: Confirm on left (default)
                        [ConfirmBtn, CancelBtn]
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default ConfirmButton;

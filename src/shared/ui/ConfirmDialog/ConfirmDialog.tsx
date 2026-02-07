/**
 * ConfirmDialog Primitive
 * 
 * Modal confirmation for destructive actions.
 * For high-stakes or irreversible deletions like deleting integrations, user accounts, etc.
 * 
 * Features:
 * - Minimal design (no header/footer chrome)
 * - Desktop: positioned ~25% from top (not centered)
 * - Mobile: centered
 * - Smooth fade animations
 * - Loading state support
 * - Keyboard handling (Escape to cancel)
 * 
 * @example
 * <ConfirmDialog
 *   open={showConfirm}
 *   onOpenChange={setShowConfirm}
 *   title="Delete this widget?"
 *   message="This action cannot be undone."
 *   onConfirm={handleDelete}
 * />
 * 
 * @example
 * // With loading state
 * <ConfirmDialog
 *   open={showConfirm}
 *   onOpenChange={setShowConfirm}
 *   title="Remove user?"
 *   message="They will lose access to all shared dashboards."
 *   confirmLabel="Remove User"
 *   onConfirm={handleRemove}
 *   loading={removing}
 * />
 */

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useScrollLock } from '../../hooks/useScrollLock';
import { scaleIn, backdrop } from '../animations';

// ===========================
// Types
// ===========================

export interface ConfirmDialogProps {
    /** Controlled open state */
    open: boolean;
    /** Open state handler */
    onOpenChange: (open: boolean) => void;
    /** Confirmation question/title */
    title: string;
    /** Additional context message */
    message?: string;
    /** Confirm button text */
    confirmLabel?: string;
    /** Cancel button text */
    cancelLabel?: string;
    /** Called when user confirms */
    onConfirm: () => void;
    /** Button color variant */
    variant?: 'danger' | 'warning';
    /** Show loading state */
    loading?: boolean;
    /** Show icon in dialog */
    showIcon?: boolean;
}

// ===========================
// Variant Styles
// ===========================

const variantStyles = {
    danger: {
        icon: 'text-error',
        iconBg: 'bg-error/10',
        button: 'bg-error hover:bg-error/90',
    },
    warning: {
        icon: 'text-warning',
        iconBg: 'bg-warning/10',
        button: 'bg-warning hover:bg-warning/90',
    },
} as const;

// ===========================
// Component
// ===========================

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    onConfirm,
    variant = 'danger',
    loading = false,
    showIcon = true,
}: ConfirmDialogProps) {
    // Use iOS-compatible scroll lock
    useScrollLock(open);

    const styles = variantStyles[variant];

    const handleConfirm = () => {
        onConfirm();
    };

    const handleCancel = () => {
        if (!loading) {
            onOpenChange(false);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={loading ? undefined : onOpenChange}>
            <AnimatePresence>
                {open && (
                    <Dialog.Portal forceMount>
                        {/* Backdrop */}
                        <Dialog.Overlay asChild>
                            <motion.div
                                variants={backdrop}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
                            />
                        </Dialog.Overlay>

                        {/* Content wrapper - Desktop: 25% from top, Mobile: centered */}
                        <div className="fixed inset-0 z-[110] flex items-start md:items-start justify-center pt-[15vh] md:pt-[20vh] p-4">
                            <Dialog.Content asChild>
                                <motion.div
                                    variants={scaleIn}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    className="
                                        w-full max-w-md
                                        bg-theme-secondary border border-theme rounded-xl
                                        shadow-2xl
                                        p-6
                                        outline-none
                                    "
                                >
                                    <div className="flex flex-col items-center text-center">
                                        {/* Icon */}
                                        {showIcon && (
                                            <div className={`
                                                w-12 h-12 rounded-full mb-4
                                                flex items-center justify-center
                                                ${styles.iconBg}
                                            `}>
                                                <AlertTriangle size={24} className={styles.icon} />
                                            </div>
                                        )}

                                        {/* Title */}
                                        <Dialog.Title className="text-lg font-medium text-theme-primary mb-2">
                                            {title}
                                        </Dialog.Title>

                                        {/* Message / Description */}
                                        {message ? (
                                            <Dialog.Description className="text-sm text-theme-secondary mb-6">
                                                {message}
                                            </Dialog.Description>
                                        ) : (
                                            /* Hidden description for Radix accessibility */
                                            <Dialog.Description className="sr-only">Confirmation dialog</Dialog.Description>
                                        )}

                                        {/* Actions */}
                                        <div className="flex items-center justify-center gap-3 w-full">
                                            {/* Cancel Button */}
                                            <button
                                                type="button"
                                                onClick={handleCancel}
                                                disabled={loading}
                                                className="
                                                    flex-1 h-10 px-4
                                                    rounded-lg font-medium text-sm
                                                    bg-theme-tertiary text-theme-primary
                                                    hover:bg-theme-hover
                                                    disabled:opacity-50 disabled:cursor-not-allowed
                                                    transition-colors
                                                "
                                            >
                                                {cancelLabel}
                                            </button>

                                            {/* Confirm Button */}
                                            <button
                                                type="button"
                                                onClick={handleConfirm}
                                                disabled={loading}
                                                className={`
                                                    flex-1 h-10 px-4
                                                    rounded-lg font-medium text-sm
                                                    text-white
                                                    disabled:opacity-50 disabled:cursor-not-allowed
                                                    transition-colors
                                                    inline-flex items-center justify-center gap-2
                                                    ${styles.button}
                                                `}
                                            >
                                                {loading && (
                                                    <Loader2 size={16} className="animate-spin" />
                                                )}
                                                {confirmLabel}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </Dialog.Content>
                        </div>
                    </Dialog.Portal>
                )}
            </AnimatePresence>
        </Dialog.Root>
    );
}

export default ConfirmDialog;

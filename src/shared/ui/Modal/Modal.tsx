/**
 * Modal Primitive
 * 
 * Foundation for all dialogs in Framerr.
 * Uses Radix Dialog for accessibility and Framer Motion for animations.
 * 
 * Features:
 * - Scroll lock (iOS compatible via useScrollLock)
 * - Focus trap (built into Radix)
 * - Keyboard handling (Escape to close)
 * - Click outside to close
 * - Smooth animations
 * 
 * @example
 * <Modal open={isOpen} onOpenChange={setIsOpen} size="md">
 *   <Modal.Header title="Edit Widget" />
 *   <Modal.Body>
 *     <form>...</form>
 *   </Modal.Body>
 *   <Modal.Footer>
 *     <Button onClick={handleCancel}>Cancel</Button>
 *     <Button onClick={handleSave}>Save</Button>
 *   </Modal.Footer>
 * </Modal>
 */

import React, { createContext, useContext, forwardRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useScrollLock } from '../../hooks/useScrollLock';
import { scaleIn, backdrop } from '../animations';

// ===========================
// Context for Modal state
// ===========================

interface ModalContextValue {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext() {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('Modal compound components must be used within <Modal>');
    }
    return context;
}

// ===========================
// Context for Portal-aware children (e.g. Popover)
// When inside a Modal, Popovers should NOT portal to body
// so they stay within react-remove-scroll's scope.
// ===========================

const InsideModalContext = createContext(false);

export function useInsideModal() {
    return useContext(InsideModalContext);
}

// ===========================
// Size Variants
// ===========================

const sizeClasses = {
    sm: 'max-w-sm',      // 384px
    md: 'max-w-lg',      // 512px  
    lg: 'max-w-2xl',     // 672px
    xl: 'max-w-4xl',     // 896px
    full: 'max-w-[95vw] w-full h-[90vh]',
} as const;

export type ModalSize = keyof typeof sizeClasses;

// ===========================
// Modal Root
// ===========================

export interface ModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    size?: ModalSize;
    children: React.ReactNode;
    className?: string;
    /** z-index for the overlay and content wrapper (default: 100) */
    zIndex?: number;
    /** When true, the modal uses a fixed height (65vh) instead of adapting to content.
     *  Use for multi-view modals (tabs, drill-downs) to prevent layout shifts. */
    fixedHeight?: boolean;
    /** When true, skip the exit animation so the portal unmounts instantly.
     *  Use when the modal is already visually hidden (e.g., during drag-and-drop). */
    skipExitAnimation?: boolean;
}

export function Modal({
    open,
    onOpenChange,
    size = 'md',
    children,
    className = '',
    zIndex = 100,
    fixedHeight = false,
    skipExitAnimation = false,
}: ModalProps) {
    // Use our iOS-compatible scroll lock
    useScrollLock(open);

    return (
        <ModalContext.Provider value={{ open, onOpenChange }}>
            <InsideModalContext.Provider value={true}>
                <Dialog.Root open={open} onOpenChange={onOpenChange}>
                    {skipExitAnimation ? (
                        /* Instant mount/unmount — no exit animation.
                           Used when portal is already hidden (e.g., drag-and-drop). */
                        open && (
                            <Dialog.Portal forceMount>
                                <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex }} />
                                <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4" style={{ zIndex }}>
                                    <Dialog.Content
                                        className={`
                          w-full ${sizeClasses[size]}
                          relative
                          bg-theme-secondary border border-theme rounded-2xl
                          shadow-2xl
                          flex flex-col
                          ${fixedHeight ? 'h-[65vh]' : 'max-h-[var(--modal-max-height)]'}
                          outline-none
                          ${className}
                        `}
                                    >
                                        {children}
                                    </Dialog.Content>
                                </div>
                            </Dialog.Portal>
                        )
                    ) : (
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
                                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                                            style={{ zIndex }}
                                        />
                                    </Dialog.Overlay>

                                    {/* Content wrapper - centers the modal */}
                                    <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4" style={{ zIndex }}>
                                        <Dialog.Content asChild>
                                            <motion.div
                                                variants={scaleIn}
                                                initial="hidden"
                                                animate="visible"
                                                exit="exit"
                                                layout
                                                transition={{
                                                    layout: { duration: 0.35, ease: [0.4, 0, 0.2, 1] }
                                                }}
                                                className={`
                          w-full ${sizeClasses[size]}
                          relative
                          bg-theme-secondary border border-theme rounded-2xl
                          shadow-2xl
                          flex flex-col
                          ${fixedHeight ? 'h-[65vh]' : 'max-h-[var(--modal-max-height)]'}
                          outline-none
                          ${className}
                        `}
                                            >
                                                {children}
                                            </motion.div>
                                        </Dialog.Content>
                                    </div>
                                </Dialog.Portal>
                            )}
                        </AnimatePresence>
                    )}
                </Dialog.Root>
            </InsideModalContext.Provider>
        </ModalContext.Provider>
    );
}

// ===========================
// Modal.Header
// ===========================

export interface ModalHeaderProps {
    title?: string | React.ReactNode;
    subtitle?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    showClose?: boolean;
    /** Compact mode: just the close button, no border, reduced height. 
     *  Use for content-first modals that don't need a visible title bar. */
    closeOnly?: boolean;
    className?: string;
    /** Additional props to spread on the close button (e.g., data-walkthrough) */
    closeButtonProps?: React.HTMLAttributes<HTMLButtonElement>;
}

const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
    ({ title, subtitle, icon, actions, showClose = true, closeOnly = false, className = '', closeButtonProps }, ref) => {
        const { onOpenChange } = useModalContext();

        // Close-only mode: compact borderless row with just the X button
        if (closeOnly) {
            return (
                <div
                    ref={ref}
                    className={`
                      flex items-center justify-end pt-3 px-3 pb-0 sm:pt-4 sm:px-4
                      flex-shrink-0
                      ${className}
                    `}
                >
                    {/* Hidden a11y elements */}
                    <Dialog.Title className="sr-only">Dialog</Dialog.Title>
                    <Dialog.Description className="sr-only">Modal dialog content</Dialog.Description>
                    {showClose && (
                        <Dialog.Close asChild>
                            <button
                                className="
                                    p-2 rounded-lg
                                    text-theme-secondary hover:text-theme-primary
                                    hover:bg-theme-hover transition-colors
                                "
                                aria-label="Close"
                                {...closeButtonProps}
                            >
                                <X size={20} />
                            </button>
                        </Dialog.Close>
                    )}
                </div>
            );
        }

        return (
            <div
                ref={ref}
                className={`
          flex items-center justify-between p-3 sm:p-4 border-b border-theme
          flex-shrink-0
          ${className}
        `}
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {icon && (
                        <div className="w-10 h-10 rounded-xl bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                            {icon}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        {typeof title === 'string' ? (
                            <Dialog.Title className="text-lg font-semibold text-theme-primary truncate">
                                {title}
                            </Dialog.Title>
                        ) : (
                            <>
                                {/* Hidden title for accessibility when using ReactNode */}
                                <Dialog.Title className="sr-only">Dialog</Dialog.Title>
                                {title}
                            </>
                        )}
                        {subtitle ? (
                            <Dialog.Description className="text-sm text-theme-tertiary">
                                {subtitle}
                            </Dialog.Description>
                        ) : (
                            /* Hidden description for Radix accessibility */
                            <Dialog.Description className="sr-only">Modal dialog content</Dialog.Description>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {actions}
                    {showClose && (
                        <Dialog.Close asChild>
                            <button
                                className="
                  p-2 rounded-lg
                  text-theme-secondary hover:text-theme-primary
                  hover:bg-theme-hover transition-colors
                "
                                aria-label="Close"
                                {...closeButtonProps}
                            >
                                <X size={20} />
                            </button>
                        </Dialog.Close>
                    )}
                </div>
            </div>
        );
    }
);

ModalHeader.displayName = 'Modal.Header';

// ===========================
// Modal.Body
// ===========================

export interface ModalBodyProps {
    children: React.ReactNode;
    className?: string;
    /** Whether to add padding (default: true) */
    padded?: boolean;
    /** Optional inline styles */
    style?: React.CSSProperties;
}

const ModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(
    ({ children, className = '', padded = true, style }, ref) => {
        return (
            <div
                ref={ref}
                data-scroll-lock-allow
                className={`
          flex-1 overflow-y-auto
          ${padded ? 'p-4 sm:p-6' : ''}
          ${className}
        `}
                style={style}
            >
                {children}
            </div>
        );
    }
);

ModalBody.displayName = 'Modal.Body';

// ===========================
// Modal.Footer
// ===========================

export interface ModalFooterProps {
    children: React.ReactNode;
    className?: string;
}

const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
    ({ children, className = '' }, ref) => {
        return (
            <div
                ref={ref}
                className={`
          p-3 sm:p-4 border-t border-theme bg-theme-primary/30
          flex-shrink-0
          flex items-center justify-end gap-3
          ${className}
        `}
            >
                {children}
            </div>
        );
    }
);

ModalFooter.displayName = 'Modal.Footer';

// ===========================
// Attach compound components
// ===========================

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export { ModalHeader, ModalBody, ModalFooter };

/**
 * PortalModal - Reusable modal wrapper using React Portal
 * 
 * Used by: MediaInfoModal, PlaybackDataModal, RequestInfoModal
 * 
 * Features:
 * - Renders to document.body via createPortal
 * - Glassmorphic backdrop with blur
 * - Responsive sizing (mobile-friendly)
 * - Click-outside to close
 * - Keyboard escape to close
 * - Header with title and close button
 * - Scrollable body section
 * 
 * @example
 * <PortalModal
 *     isOpen={showModal}
 *     onClose={() => setShowModal(false)}
 *     title="Modal Title"
 * >
 *     <p>Modal content here</p>
 * </PortalModal>
 */

import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useLayout } from '../../context/LayoutContext';

// ============================================================================
// SECTION: Types
// ============================================================================

export interface PortalModalProps {
    /** Whether the modal is currently visible */
    isOpen: boolean;
    /** Callback when the modal should close */
    onClose: () => void;
    /** Optional title for the modal header */
    title?: string;
    /** Maximum width of the modal (default: 600px) */
    maxWidth?: string;
    /** Whether to show the header (default: true if title provided) */
    showHeader?: boolean;
    /** Additional className for the modal content container */
    className?: string;
    /** Modal content */
    children: React.ReactNode;
}

// ============================================================================
// SECTION: Component Implementation
// ============================================================================

const PortalModal: React.FC<PortalModalProps> = ({
    isOpen,
    onClose,
    title,
    maxWidth = '600px',
    showHeader = true,
    className = '',
    children
}) => {
    const { isMobile } = useLayout();

    // Handle escape key to close
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem',
                paddingTop: 'max(1rem, env(safe-area-inset-top))',
                overflowY: 'auto'
            }}
            onClick={onClose}
        >
            <div
                className={className}
                style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    width: '100%',
                    maxWidth: maxWidth,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    border: '1px solid var(--border)',
                    maxHeight: isMobile ? '66vh' : '90vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                {showHeader && (title !== undefined) && (
                    <div style={{
                        padding: '1.5rem',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0
                    }}>
                        <h3 style={{
                            margin: 0,
                            fontSize: '1.2rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)'
                        }}>
                            {title}
                        </h3>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'var(--bg-hover)',
                                border: 'none',
                                borderRadius: '6px',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}

                {/* Scrollable Body */}
                <div style={{
                    padding: '1.5rem',
                    overflowY: 'auto',
                    flex: 1
                }}>
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PortalModal;

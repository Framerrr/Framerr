/**
 * TemplatePreviewModal - Read-only preview of template layout
 * 
 * Uses TemplateBuilderStep2 in preview mode for consistent rendering
 * with the builder steps. This ensures the same GridStack-based layout
 * is used everywhere.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Edit2 } from 'lucide-react';
import { Button } from '../../../shared/ui';
import TemplateBuilderStep2 from '../builder/TemplateBuilderStep2';
import type { Template } from './TemplateCard';
import type { TemplateData } from '../builder/types';

interface TemplatePreviewModalProps {
    template: Template;
    isOpen: boolean;
    onClose: () => void;
    onApply: (template: Template) => void;
    onEdit: (template: Template) => void;
    isMobile?: boolean;
}

const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
    template,
    isOpen,
    onClose,
    onApply,
    onEdit,
    isMobile = false,
}) => {
    // Track if Step2 is ready (grid initialized)
    const [isReady, setIsReady] = useState(false);

    // Reset ready state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setIsReady(false);
        }
    }, [isOpen]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Convert Template to TemplateData format for Step2
    // Template.widgets lacks 'id' property, so we generate stable IDs for preview
    const templateData: TemplateData = useMemo(() => ({
        name: template.name,
        description: template.description || '',
        categoryId: template.categoryId || '',
        isDraft: false, // Preview modal only shows published templates
        widgets: template.widgets.map((w, i) => ({
            ...w,
            id: `preview-${i}-${w.type}`,
        })),
        mobileWidgets: template.mobileWidgets?.map((w, i) => ({
            ...w,
            id: `preview-mobile-${i}-${w.type}`,
        })),
        mobileLayoutMode: template.mobileLayoutMode || 'linked',
    }), [template]);

    // No-op onChange for preview mode (read-only)
    const handleChange = useCallback(() => {
        // Preview mode is read-only, no changes
    }, []);

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[1050] flex items-center justify-center p-4"
                    style={isMobile ? {
                        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                        paddingBottom: 'calc(86px + env(safe-area-inset-bottom, 0px) + 16px)'
                    } : undefined}
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        layoutId={`template-preview-${template.id}`}
                        className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-theme-secondary rounded-xl border border-theme shadow-2xl flex flex-col overflow-hidden"
                        layout
                        transition={{
                            layout: { type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.35 }
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-theme">
                            <div>
                                <h2 className="text-lg font-semibold text-theme-primary">{template.name}</h2>
                                {template.description && (
                                    <p className="text-sm text-theme-tertiary">{template.description}</p>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Preview Grid - uses Step2 in preview mode */}
                        <div className="flex-1 overflow-auto min-h-0">
                            <TemplateBuilderStep2
                                data={templateData}
                                onChange={handleChange}
                                isAdmin={false}
                                onReady={() => setIsReady(true)}
                                isPreviewMode={true}
                                maxGridHeight={500}
                            />
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-end gap-3 p-4 border-t border-theme">
                            {!isMobile && (
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        onClose();
                                        onEdit(template);
                                    }}
                                >
                                    <Edit2 size={14} />
                                    Edit
                                </Button>
                            )}
                            <Button
                                variant="primary"
                                onClick={() => {
                                    onClose();
                                    onApply(template);
                                }}
                            >
                                <Play size={14} />
                                Apply Template
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
};

export default TemplatePreviewModal;

/**
 * TemplatePreviewModal - Read-only preview of template layout
 *
 * Uses TemplateBuilderStep2 in preview mode for consistent rendering
 * with the builder steps. This ensures the same GridStack-based layout
 * is used everywhere.
 */

import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Edit2 } from 'lucide-react';
import { Button } from '../../../shared/ui';
import TemplateBuilderStep2 from '../builder/TemplateBuilderStep2';
import TemplateThumbnail from './TemplateThumbnail';
import type { Template } from './TemplateCard';
import type { TemplateData } from '../builder/types';

interface TemplatePreviewModalProps {
    template: Template;
    isOpen: boolean;
    onClose: () => void;
    onExited: () => void;
    onApply: (template: Template) => void;
    onEdit: (template: Template) => void;
    isMobile?: boolean;
}

/** Must match panel `transition.layout.duration` — close always runs this long. */
const LAYOUT_MORPH_MS = 350;

const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
    template,
    isOpen,
    onClose,
    onExited,
    onApply,
    onEdit,
    isMobile = false,
}) => {
    const [, setIsReady] = useState(false);
    const [contentReady, setContentReady] = useState(false);
    /** Bumped on every close so morph scheduling runs even when contentReady was already false. */
    const [closeEpoch, setCloseEpoch] = useState(0);
    const [standInSize, setStandInSize] = useState<{ w: number; h: number } | null>(null);
    const previewPaneRef = useRef<HTMLDivElement>(null);
    const isClosingRef = useRef(false);
    const exitMorphStartedRef = useRef(false);
    const onCloseRef = useRef(onClose);
    const settleTimerRef = useRef<number | null>(null);
    const pendingActionRef = useRef<'edit' | 'apply' | null>(null);
    const exitedRef = useRef(false);
    const morphTimerRef = useRef<number | null>(null);
    const preMorphRafRef = useRef<number | null>(null);

    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useLayoutEffect(() => {
        if (!isOpen) return;
        const el = previewPaneRef.current;
        if (!el) return;
        setStandInSize({ w: el.clientWidth, h: el.clientHeight });
    }, [isOpen, template.id]);

    const finishExit = useCallback(() => {
        if (exitedRef.current) return;
        exitedRef.current = true;
        if (morphTimerRef.current) {
            clearTimeout(morphTimerRef.current);
            morphTimerRef.current = null;
        }
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        onExited();
        if (action === 'edit') onEdit(template);
        else if (action === 'apply') onApply(template);
    }, [onExited, onEdit, onApply, template]);

    // Phase 1 → 2: once Step2 is torn down and the stand-in has painted, start the
    // reverse layoutId morph on a fixed clock (no requestIdleCallback / no early finish).
    useEffect(() => {
        if (closeEpoch === 0) return;
        if (!isClosingRef.current) return;
        if (contentReady) return; // still showing Step2
        if (exitMorphStartedRef.current) return;

        let cancelled = false;
        const r1 = requestAnimationFrame(() => {
            preMorphRafRef.current = requestAnimationFrame(() => {
                if (cancelled || exitMorphStartedRef.current) return;
                exitMorphStartedRef.current = true;
                onCloseRef.current(); // isOpen=false → chip becomes morph target
                morphTimerRef.current = window.setTimeout(() => finishExit(), LAYOUT_MORPH_MS);
            });
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(r1);
            if (preMorphRafRef.current != null) {
                cancelAnimationFrame(preMorphRafRef.current);
                preMorphRafRef.current = null;
            }
        };
    }, [contentReady, closeEpoch, finishExit]);

    const handleClose = useCallback((action?: 'edit' | 'apply') => {
        if (isClosingRef.current) return;
        isClosingRef.current = true;
        pendingActionRef.current = action ?? null;
        if (settleTimerRef.current) {
            clearTimeout(settleTimerRef.current);
            settleTimerRef.current = null;
        }
        setIsReady(false);
        setContentReady(false); // phase 1
        setCloseEpoch((n) => n + 1); // always schedule morph (even if already on stand-in)
    }, []);

    useEffect(() => () => {
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
        if (preMorphRafRef.current != null) cancelAnimationFrame(preMorphRafRef.current);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setContentReady(false);
            return;
        }
        isClosingRef.current = false;
        exitMorphStartedRef.current = false;
        exitedRef.current = false;
        pendingActionRef.current = null;
        setContentReady(false);
        settleTimerRef.current = window.setTimeout(() => {
            if (isClosingRef.current) return;
            setContentReady(true);
        }, 600);
        return () => {
            if (settleTimerRef.current) {
                clearTimeout(settleTimerRef.current);
                settleTimerRef.current = null;
            }
        };
    }, [isOpen, template.id]);

    const templateData: TemplateData = useMemo(() => ({
        name: template.name,
        description: template.description || '',
        categoryId: template.categoryId || '',
        isDraft: false,
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

    const handleChange = useCallback(() => {
        // Preview mode is read-only
    }, []);

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key={`preview-${template.id}`}
                    className="fixed inset-0 z-[1050] flex items-center justify-center p-4"
                    // Hold exiting tree for the full morph; don't fade the shell away.
                    exit={{ opacity: 1 }}
                    transition={{ duration: LAYOUT_MORPH_MS / 1000 }}
                    style={isMobile ? {
                        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                        paddingBottom: 'calc(86px + env(safe-area-inset-bottom, 0px) + 16px)'
                    } : undefined}
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`absolute inset-0 bg-black/60 transition-[backdrop-filter] duration-200 ${contentReady ? 'backdrop-blur-sm' : ''}`}
                        onClick={() => handleClose()}
                    />

                    <motion.div
                        layoutId={`template-preview-${template.id}`}
                        className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-theme-secondary rounded-xl border border-theme shadow-2xl flex flex-col overflow-hidden"
                        transition={{
                            layout: { type: 'tween', ease: [0.4, 0, 0.2, 1], duration: LAYOUT_MORPH_MS / 1000 }
                        }}
                        onLayoutAnimationComplete={() => {
                            if (settleTimerRef.current) {
                                clearTimeout(settleTimerRef.current);
                                settleTimerRef.current = null;
                            }
                            // Close path uses a fixed morph timer — do not finishExit here
                            // (shared-layout complete is unreliable and caused inconsistent cuts).
                            if (isClosingRef.current) return;
                            setContentReady(true);
                        }}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-theme">
                            <div>
                                <h2 className="text-lg font-semibold text-theme-primary">{template.name}</h2>
                                {template.description && (
                                    <p className="text-sm text-theme-tertiary">{template.description}</p>
                                )}
                            </div>
                            <button
                                onClick={() => handleClose()}
                                className="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-tertiary transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div ref={previewPaneRef} className="flex-1 overflow-auto min-h-0">
                            {contentReady ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <TemplateBuilderStep2
                                        data={templateData}
                                        onChange={handleChange}
                                        isAdmin={false}
                                        onReady={() => setIsReady(true)}
                                        isPreviewMode={true}
                                        maxGridHeight={500}
                                    />
                                </motion.div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <TemplateThumbnail
                                        widgets={template.widgets}
                                        width={standInSize?.w ?? 640}
                                        height={standInSize?.h ?? 360}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 p-4 border-t border-theme">
                            {!isMobile && (
                                <Button
                                    variant="secondary"
                                    onClick={() => handleClose('edit')}
                                >
                                    <Edit2 size={14} />
                                    Edit
                                </Button>
                            )}
                            <Button
                                variant="primary"
                                onClick={() => handleClose('apply')}
                            >
                                <Play size={14} />
                                Apply Template
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
};

export default TemplatePreviewModal;

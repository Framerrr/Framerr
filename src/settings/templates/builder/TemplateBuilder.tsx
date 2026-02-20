/**
 * TemplateBuilder - Main wizard container for creating/editing templates
 * 
 * A 3-step wizard:
 * 1. Setup - Name, category, description
 * 2. Build - Visual grid editor (Phase 3)
 * 3. Review - Preview and save actions
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { templatesApi } from '../../../api/endpoints';
import { Monitor } from 'lucide-react';
import { Modal } from '../../../shared/ui/Modal';
import ConfirmDialog from '../../../shared/ui/ConfirmDialog/ConfirmDialog';
import TemplateBuilderStep1 from './TemplateBuilderStep1';
import TemplateBuilderStep2 from './TemplateBuilderStep2';
import { Button } from '../../../shared/ui';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { useLayout } from '../../../context/LayoutContext';
import logger from '../../../utils/logger';

// Import types from centralized types file
import type { TemplateWidget, TemplateData } from './types';

// Re-export for consumers
export type { TemplateWidget, TemplateData };

interface TemplateBuilderProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Partial<TemplateData>;
    mode: 'create' | 'edit' | 'duplicate' | 'save-current';
    editingTemplateId?: string;
    onSave?: (template: TemplateData) => void;
    onShare?: (template: TemplateData & { id: string }) => void;
    onDraftSaved?: () => void; // Called when user explicitly saves draft
    isAdmin?: boolean;
}

const STEPS = [
    { id: 1, label: 'Setup' },
    { id: 2, label: 'Build' },
    { id: 3, label: 'Review' },
];

const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
    isOpen,
    onClose,
    initialData,
    mode,
    editingTemplateId,
    onSave,
    onShare,
    onDraftSaved,
    isAdmin = false,
}) => {
    const { isMobile } = useLayout();
    const [currentStep, setCurrentStep] = useState(1);
    const [isDirty, setIsDirty] = useState(false);
    const [showConfirmClose, setShowConfirmClose] = useState(false);

    // Edit mode: no drafts, discard = revert (not delete)
    const isEditMode = mode === 'edit';

    // Draft save state (only used in create/duplicate/save-current modes)
    const [draftId, setDraftId] = useState<string | null>(null);
    const isSavingRef = useRef(false);

    // Template data state
    const [templateData, setTemplateData] = useState<TemplateData>({
        name: initialData?.name || '',
        description: initialData?.description || '',
        categoryId: initialData?.categoryId || null,
        widgets: initialData?.widgets || [],
        isDraft: initialData?.isDraft || false,
        isDefault: initialData?.isDefault || false,
        mobileLayoutMode: initialData?.mobileLayoutMode,
        mobileWidgets: initialData?.mobileWidgets,
        ...(initialData?.id && { id: initialData.id }),
    });

    // Ref to always access current templateData in callbacks (avoids stale closures)
    const templateDataRef = useRef(templateData);
    templateDataRef.current = templateData;

    // Track previous isOpen state to detect open transition
    const prevIsOpenRef = useRef(false);

    // Reset state ONLY when modal opens (transition from false to true)
    // Don't reset on every initialData or editingTemplateId change while open
    React.useEffect(() => {
        const wasOpen = prevIsOpenRef.current;
        prevIsOpenRef.current = isOpen;

        // Only reset when transitioning from closed to open
        if (isOpen && !wasOpen) {
            setCurrentStep(1);
            setIsDirty(false);
            setShowConfirmClose(false);
            // Use existing ID if editing, or initialData.id for drafts
            setDraftId(editingTemplateId || initialData?.id || null);
            setTemplateData({
                name: initialData?.name || '',
                description: initialData?.description || '',
                categoryId: initialData?.categoryId || null,
                widgets: initialData?.widgets || [],
                isDraft: initialData?.isDraft || false,
                isDefault: initialData?.isDefault || false,
                mobileLayoutMode: initialData?.mobileLayoutMode,
                mobileWidgets: initialData?.mobileWidgets,
                ...(initialData?.id && { id: initialData.id }),
            });
        }
    }, [isOpen, initialData, editingTemplateId]);

    // ========== STEP TRANSITION LOADING ==========
    // Show 300ms loading on every step change to mask content size differences
    const [isTransitioning, setIsTransitioning] = useState(true); // Start with loading
    const prevStepRef = useRef(currentStep);

    useEffect(() => {
        // On initial mount or step change, show loading for 300ms
        if (prevStepRef.current !== currentStep || isOpen) {
            prevStepRef.current = currentStep;
            setIsTransitioning(true);
            const timer = setTimeout(() => setIsTransitioning(false), 300);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [currentStep, isOpen]);

    // Reset when modal closes
    useEffect(() => {
        if (!isOpen) {
            setIsTransitioning(true);
        }
    }, [isOpen]);

    // Delayed spinner - only show if loading takes longer than 5 seconds
    const [showSpinner, setShowSpinner] = useState(false);
    useEffect(() => {
        if (isTransitioning) {
            const timer = setTimeout(() => setShowSpinner(true), 5000);
            return () => clearTimeout(timer);
        }
        setShowSpinner(false);
        return undefined;
    }, [isTransitioning]);

    // onReady callbacks are now just for initial pre-rendering (can be no-ops after first load)
    const markStep1Ready = useCallback(() => { }, []);
    const markStep2Ready = useCallback(() => { }, []);

    // Handle close with confirmation if dirty
    const handleClose = useCallback(() => {
        if (isDirty) {
            setShowConfirmClose(true);
        } else {
            onClose();
        }
    }, [isDirty, onClose]);


    // Update template data and mark as dirty
    const updateTemplateData = useCallback((updates: Partial<TemplateData>) => {
        setTemplateData(prev => ({ ...prev, ...updates }));
        setIsDirty(true);
    }, []);

    // Step navigation
    const canGoNext = () => {
        if (currentStep === 1) {
            return templateData.name.trim().length > 0;
        }
        return true;
    };

    // Save draft to API (skip in edit mode - no drafts when editing existing templates)
    const saveDraft = useCallback(async () => {
        // In edit mode, we don't create drafts - changes are either saved or discarded
        if (isEditMode) return;

        if (isSavingRef.current) return;
        isSavingRef.current = true;

        // Use ref to get current state (avoids stale closure issues)
        const currentData = templateDataRef.current;

        try {
            const response = await templatesApi.saveDraft({
                templateId: draftId,
                name: currentData.name || 'Untitled Draft',
                description: currentData.description,
                categoryId: currentData.categoryId || undefined,
                widgets: currentData.widgets,
                // Mobile layout data
                mobileLayoutMode: currentData.mobileLayoutMode || 'linked',
                mobileWidgets: currentData.mobileLayoutMode === 'independent' ? currentData.mobileWidgets : undefined,
            });

            // Store draft ID for subsequent saves
            const newDraftId = response.template?.id;
            if (!draftId && newDraftId) {
                setDraftId(newDraftId);
                // IMPORTANT: Also update templateData.id so Step3 uses PUT instead of POST
                setTemplateData(prev => ({ ...prev, id: newDraftId }));
            }

            logger.debug('Draft saved', { id: newDraftId, widgetCount: currentData.widgets.length });
        } catch (err) {
            logger.error('Failed to save draft', { error: err });
        } finally {
            isSavingRef.current = false;
        }
    }, [isEditMode, draftId]);

    const handleNext = async () => {
        if (currentStep < 3 && canGoNext()) {
            // Save draft when leaving Step 1
            if (currentStep === 1) {
                await saveDraft();
            }
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleStepClick = (step: number) => {
        if (step <= currentStep || (step === currentStep + 1 && canGoNext())) {
            setCurrentStep(step);
        }
    };

    // Get title based on mode
    const getTitle = () => {
        switch (mode) {
            case 'create':
                return 'Create New Template';
            case 'edit':
                return 'Edit Template';
            case 'duplicate':
                return 'Duplicate Template';
            case 'save-current':
                return 'Save Dashboard as Template';
            default:
                return 'Template Builder';
        }
    };

    // Quick save for edit mode Step 1 (same logic as Step3 handleSave)
    const handleQuickSave = useCallback(async () => {
        if (!templateData.name.trim()) return;

        try {
            const saveData = {
                name: templateData.name,
                description: templateData.description || undefined,
                categoryId: templateData.categoryId || undefined,
                widgets: templateData.widgets,
                isDraft: false,
                isDefault: templateData.isDefault || false,
                // Include mobile layout data to prevent clearing on Step1 save
                mobileLayoutMode: templateData.mobileLayoutMode || 'linked',
                mobileWidgets: templateData.mobileLayoutMode === 'independent' ? templateData.mobileWidgets : undefined,
            };

            const response = templateData.id
                ? await templatesApi.update(templateData.id, saveData)
                : await templatesApi.create(saveData);

            const savedTemplate = response.template;

            // Handle default template setting/clearing
            if (templateData.isDefault) {
                try {
                    await templatesApi.setDefault(savedTemplate.id);
                    logger.info('Template set as default for new users', { templateId: savedTemplate.id });
                } catch (defaultError) {
                    logger.error('Failed to set template as default:', { error: defaultError });
                }
            }

            // Call onSave callback if provided
            if (onSave) {
                onSave(savedTemplate as unknown as TemplateData);
            }

            setIsDirty(false);
            onClose();
        } catch (error) {
            logger.error('Failed to quick save template:', { error });
        }
    }, [templateData, onSave, onClose]);

    // Step 3 saving state (managed here so footer can show state)
    const [step3Saving, setStep3Saving] = useState(false);
    const [step3SaveAction, setStep3SaveAction] = useState<'save' | 'apply' | 'share' | null>(null);

    // Step 3 save handler - moved from TemplateBuilderStep3
    const handleStep3Save = useCallback(async (action: 'save' | 'apply' | 'share') => {
        if (!templateData.name.trim()) return;

        setStep3Saving(true);
        setStep3SaveAction(action);

        try {
            const saveData = {
                name: templateData.name,
                description: templateData.description || undefined,
                categoryId: templateData.categoryId || undefined,
                widgets: templateData.widgets,
                isDraft: false,
                isDefault: templateData.isDefault || false,
                mobileLayoutMode: templateData.mobileLayoutMode || 'linked',
                mobileWidgets: templateData.mobileLayoutMode === 'independent' ? templateData.mobileWidgets : undefined,
            };

            const response = templateData.id
                ? await templatesApi.update(templateData.id, saveData)
                : await templatesApi.create(saveData);

            const savedTemplate = response.template;

            // Handle default template setting/clearing
            if (templateData.isDefault) {
                try {
                    await templatesApi.setDefault(savedTemplate.id);
                    logger.info('Template set as default for new users', { templateId: savedTemplate.id });
                } catch (defaultError) {
                    logger.error('Failed to set template as default:', { error: defaultError });
                }
            }

            // Handle action-specific logic
            if (action === 'apply') {
                await templatesApi.apply(savedTemplate.id);
                window.dispatchEvent(new CustomEvent('widgets-added'));
            }

            // Call onSave callback if provided
            if (onSave) {
                onSave(savedTemplate as unknown as TemplateData);
            }

            // For share action, close builder and trigger share modal
            if (action === 'share' && onShare) {
                onClose();
                onShare(savedTemplate as unknown as TemplateData & { id: string });
                return;
            }

            onClose();
        } catch (error) {
            logger.error('Failed to save template:', { error, action });
        } finally {
            setStep3Saving(false);
            setStep3SaveAction(null);
        }
    }, [templateData, onSave, onShare, onClose]);

    return (
        <>
            <Modal
                open={isOpen}
                onOpenChange={(open) => !open && handleClose()}
                size={currentStep === 2 ? 'full' : 'lg'}
                className="max-h-[70vh]"
            >
                <Modal.Header title={getTitle()} />
                <Modal.Body padded={false}>
                    {/* Mobile Overlay - shows when viewport is mobile but modal is open */}
                    {isMobile ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                            <Monitor size={48} className="text-theme-tertiary mb-4" />
                            <h3 className="text-lg font-semibold text-theme-primary mb-2">
                                Desktop Required
                            </h3>
                            <p className="text-sm text-theme-secondary mb-4">
                                The template builder requires a larger screen. Please resize your window or switch to a desktop device.
                            </p>
                            <p className="text-xs text-theme-tertiary">
                                Your work is saved. The builder will reappear when you return to desktop.
                            </p>
                        </div>
                    ) : (
                        /* Step Content - All steps pre-rendered for smooth transitions */
                        <>
                            {/* Loading state - spinner only after 5 seconds */}
                            {isTransitioning && showSpinner && (
                                <div className="flex items-center justify-center h-64">
                                    <LoadingSpinner size="lg" message="Preparing editor..." />
                                </div>
                            )}

                            {/* All steps rendered, hidden during transition */}
                            <div className={`relative h-full min-h-0 ${isTransitioning ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100 transition-opacity duration-200'}`}>
                                {/* Step 1 - Setup */}
                                <div className={currentStep === 1 ? '' : 'hidden'}>
                                    <div className="p-4 sm:p-6">
                                        <TemplateBuilderStep1
                                            data={templateData}
                                            onChange={updateTemplateData}
                                            isAdmin={isAdmin}
                                            onReady={markStep1Ready}
                                        />
                                    </div>
                                </div>

                                {/* Step 2 - Build (also shown on Step 3 with isPreviewMode) */}
                                <div className={currentStep === 2 || currentStep === 3 ? 'h-full overflow-hidden flex flex-col' : 'hidden'}>
                                    {/* Grid - Step2 handles its own height constraint in preview mode */}
                                    <div className="flex-1 min-h-0">
                                        <TemplateBuilderStep2
                                            data={templateData}
                                            onChange={updateTemplateData}
                                            onDraftSave={saveDraft}
                                            isAdmin={isAdmin}
                                            onReady={markStep2Ready}
                                            isPreviewMode={currentStep === 3}
                                            maxGridHeight={currentStep === 3 ? 250 : undefined}
                                        />
                                    </div>

                                    {/* Template Info Section - only on Step 3 */}
                                    {currentStep === 3 && (
                                        <div className="flex-shrink-0 p-4 sm:p-6 border-t border-theme overflow-auto">
                                            <div className="space-y-3 p-4 rounded-lg bg-theme-secondary border border-theme">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="text-sm text-theme-tertiary">Name</div>
                                                        <div className="font-medium text-theme-primary">{templateData.name || 'Untitled'}</div>
                                                    </div>
                                                </div>

                                                {templateData.description && (
                                                    <div>
                                                        <div className="text-sm text-theme-tertiary">Description</div>
                                                        <div className="text-theme-secondary text-sm">{templateData.description}</div>
                                                    </div>
                                                )}

                                                <div className="flex gap-6">
                                                    <div>
                                                        <div className="text-sm text-theme-tertiary">Category</div>
                                                        <div className="text-theme-primary">
                                                            {templateData.categoryId ? 'Custom' : 'None'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm text-theme-tertiary">Widgets</div>
                                                        <div className="text-theme-primary">
                                                            {templateData.widgets.length === 0
                                                                ? 'None'
                                                                : (() => {
                                                                    const types = [...new Set(templateData.widgets.map(w => w.type))];
                                                                    return types.length <= 3
                                                                        ? types.join(', ')
                                                                        : `${types.slice(0, 3).join(', ')} +${types.length - 3} more`;
                                                                })()
                                                            }
                                                            {templateData.widgets.length > 0 && ` (${templateData.widgets.length} total)`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </Modal.Body>
                {!isMobile && (
                    <Modal.Footer className="!justify-between w-full">
                        {/* Left: Cancel/Back */}
                        <div className="flex-shrink-0">
                            <Button
                                variant="secondary"
                                onClick={currentStep === 1 ? handleClose : handleBack}
                                disabled={step3Saving}
                            >
                                {currentStep === 1 ? 'Cancel' : '← Back'}
                            </Button>
                        </div>

                        {/* Center: Step indicators */}
                        <div className="flex-1 flex items-center justify-center gap-3">
                            {STEPS.map((step) => (
                                <button
                                    key={step.id}
                                    onClick={() => handleStepClick(step.id)}
                                    className={`w-3 h-3 rounded-full transition-all border-2 ${currentStep === step.id
                                        ? 'bg-accent border-accent scale-125'
                                        : step.id < currentStep
                                            ? 'bg-accent/60 border-accent/60'
                                            : 'bg-theme-tertiary border-theme'
                                        } cursor-pointer hover:scale-110`}
                                    title={step.label}
                                    disabled={step3Saving}
                                />
                            ))}
                        </div>

                        {/* Right: Action buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Step 1 edit mode save */}
                            {currentStep === 1 && isEditMode && isDirty && (
                                <Button
                                    variant="primary"
                                    onClick={handleQuickSave}
                                    disabled={!templateData.name.trim()}
                                >
                                    Save
                                </Button>
                            )}
                            {/* Steps 1-2: Next button */}
                            {currentStep < 3 && (
                                <Button
                                    variant={isEditMode && isDirty ? 'secondary' : 'primary'}
                                    onClick={handleNext}
                                    disabled={!canGoNext()}
                                >
                                    Next →
                                </Button>
                            )}
                            {/* Step 3: Save action buttons */}
                            {currentStep === 3 && (
                                <>
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleStep3Save('save')}
                                        disabled={step3Saving || !templateData.name.trim()}
                                    >
                                        {step3Saving && step3SaveAction === 'save' ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={() => handleStep3Save('apply')}
                                        disabled={step3Saving || !templateData.name.trim()}
                                    >
                                        {step3Saving && step3SaveAction === 'apply' ? 'Applying...' : 'Save & Apply'}
                                    </Button>
                                    {isAdmin && (
                                        <Button
                                            variant="secondary"
                                            onClick={() => handleStep3Save('share')}
                                            disabled={step3Saving || !templateData.name.trim()}
                                        >
                                            {step3Saving && step3SaveAction === 'share' ? 'Saving...' : 'Save & Share'}
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </Modal.Footer>
                )}
            </Modal >

            {/* Confirm close - different behavior for edit vs create mode */}
            <ConfirmDialog
                open={showConfirmClose}
                onOpenChange={(open) => !open && setShowConfirmClose(false)}
                title={isEditMode ? 'Discard Changes?' : 'Save as Draft?'}
                message={isEditMode
                    ? 'Your changes have not been saved. Discard changes?'
                    : 'Would you like to save your template as a draft before closing?'
                }
                confirmLabel={isEditMode ? 'Discard Changes' : 'Save Draft'}
                variant={isEditMode ? 'danger' : 'primary'}
                onConfirm={isEditMode
                    ? () => {
                        setShowConfirmClose(false);
                        onClose();
                    }
                    : () => {
                        setShowConfirmClose(false);
                        onDraftSaved?.();
                        onClose();
                    }
                }
                showIcon={false}
                secondaryAction={isEditMode ? undefined : {
                    label: 'Discard',
                    onClick: async () => {
                        if (draftId) {
                            try {
                                await templatesApi.delete(draftId);
                                logger.debug('Draft deleted', { id: draftId });
                            } catch (err) {
                                logger.error('Failed to delete draft', { error: err });
                            }
                        }
                        setShowConfirmClose(false);
                        onClose();
                    },
                    variant: 'danger',
                }}
            />
        </>
    );
};

export default TemplateBuilder;

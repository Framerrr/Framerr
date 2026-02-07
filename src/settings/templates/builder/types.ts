/**
 * Template Builder Types
 * 
 * Shared types for the template builder wizard.
 * Templates use FramerrWidget directly - same format as dashboard.
 */

import type { FramerrWidget } from '../../../hooks/useDashboardLayout';

export type ViewMode = 'desktop' | 'mobile';

// =============================================================================
// TEMPLATE DATA STRUCTURES
// =============================================================================

// Templates use FramerrWidget directly - same format as dashboard
export type TemplateWidget = FramerrWidget;

export interface TemplateData {
    id?: string;
    name: string;
    description: string;
    categoryId: string | null;
    widgets: TemplateWidget[];
    isDraft: boolean;
    isDefault?: boolean;
    mobileLayoutMode?: 'linked' | 'independent';
    mobileWidgets?: TemplateWidget[];
    cachedMobileLayout?: TemplateWidget[];
}

// =============================================================================
// BUILDER PROPS
// =============================================================================

export interface TemplateBuilderProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Partial<TemplateData>;
    mode: 'create' | 'edit' | 'duplicate' | 'save-current';
    editingTemplateId?: string;
    onSave?: (template: TemplateData) => void;
    onShare?: (template: TemplateData & { id: string }) => void;
    onDraftSaved?: () => void;
    isAdmin?: boolean;
}

export interface Step1Props {
    data: TemplateData;
    onChange: (updates: Partial<TemplateData>) => void;
    isAdmin?: boolean;
}

export interface Step2Props {
    data: TemplateData;
    onChange: (updates: Partial<TemplateData>) => void;
    onDraftSave?: (widgets?: TemplateWidget[]) => void;
    isAdmin?: boolean;
}

export interface Step3Props {
    data: TemplateData;
    onSave?: (template: TemplateData) => void;
    onShare?: (template: TemplateData & { id: string }) => void;
    onClose: () => void;
    isAdmin?: boolean;
    onSaveAction?: (action: 'save' | 'apply' | 'share') => void;
    saving?: boolean;
    saveAction?: 'save' | 'apply' | 'share' | null;
}

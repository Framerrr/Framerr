/**
 * useTemplateSettings - State management and handlers for template settings
 * 
 * Manages:
 * - Template builder state (mode, visibility, editing template)
 * - Dashboard backup/revert functionality
 * - File import handling
 * - Template CRUD operations coordination
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { templatesApi, widgetsApi } from '../../../api/endpoints';
import type { Widget } from '../../../api/endpoints/widgets';
import { useLayout } from '../../../context/LayoutContext';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import { readFramerrFile } from '../../../utils/templateExportImport';
import logger from '../../../utils/logger';
import type { Template, BackupData, BuilderMode } from '../types';

interface UseTemplateSettingsReturn {
    // Auth & layout
    isAdmin: boolean;
    isMobile: boolean;

    // Builder state
    showBuilder: boolean;
    builderMode: BuilderMode;
    editingTemplate: Template | null;
    fileInputRef: React.RefObject<HTMLInputElement | null>;

    // Backup state
    hasBackup: boolean;
    reverting: boolean;
    showRevertConfirm: boolean;

    // Sharing state
    sharingTemplate: Template | null;
    setSharingTemplate: (template: Template | null) => void;

    // Refresh trigger for child components
    refreshTrigger: number;

    // Handlers - template actions
    handleCreateNew: () => Promise<void>;
    handleSaveCurrent: () => Promise<void>;
    handleEdit: (template: Template) => void;
    handleDuplicate: (template: Template) => void;
    handleImportFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;

    // Handlers - builder
    handleBuilderClose: () => void;
    handleTemplateSaved: () => void;
    handleDraftSaved: () => void;
    getBuilderInitialData: () => Record<string, unknown> | undefined;

    // Handlers - revert
    handleRevert: () => void;
    executeRevert: () => Promise<void>;
    setShowRevertConfirm: (show: boolean) => void;

    // Notifications
    success: (title: string, message: string) => void;
    error: (title: string, message: string) => void;
}

export function useTemplateSettings(): UseTemplateSettingsReturn {
    const { user } = useAuth();
    const { isMobile } = useLayout();
    const { success, error: showError } = useNotifications();
    const isAdmin = user?.group === 'admin';

    // Builder state
    const [showBuilder, setShowBuilder] = useState(false);
    const [builderMode, setBuilderMode] = useState<BuilderMode>('create');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentWidgets, setCurrentWidgets] = useState<Widget[]>([]);
    const [currentMobileLayoutMode, setCurrentMobileLayoutMode] = useState<'linked' | 'independent'>('linked');
    const [currentMobileWidgets, setCurrentMobileWidgets] = useState<Widget[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Backup state
    const [hasBackup, setHasBackup] = useState(false);
    const [reverting, setReverting] = useState(false);
    const [showRevertConfirm, setShowRevertConfirm] = useState(false);

    // Sharing state
    const [sharingTemplate, setSharingTemplate] = useState<Template | null>(null);

    // Templates list for generating default names
    const [templates, setTemplates] = useState<Template[]>([]);

    // Generate next available default name (Dashboard 1, Dashboard 2, etc.)
    const generateDefaultName = useCallback((templateList: Template[]) => {
        const existingNumbers = templateList
            .map(t => {
                const match = t.name.match(/^Dashboard (\d+)$/);
                return match ? parseInt(match[1], 10) : null;
            })
            .filter((n): n is number => n !== null);

        let nextNumber = 1;
        while (existingNumbers.includes(nextNumber)) {
            nextNumber++;
        }
        return `Dashboard ${nextNumber}`;
    }, []);

    // Check for backup on mount and when templates are applied
    useEffect(() => {
        const checkBackup = async () => {
            try {
                const response = await templatesApi.getBackup();
                setHasBackup(!!response.backup);
            } catch (err) {
                logger.debug('No backup available');
            }
        };
        checkBackup();

        // Re-check backup when widgets are added (template applied triggers this event)
        const handleWidgetsAdded = () => {
            // Small delay to ensure API has finished creating the backup
            setTimeout(checkBackup, 500);
        };

        window.addEventListener('widgets-added', handleWidgetsAdded);
        return () => window.removeEventListener('widgets-added', handleWidgetsAdded);
    }, [refreshTrigger]);

    // Open builder in create mode (empty template)
    const handleCreateNew = useCallback(async () => {
        if (isMobile) {
            showError('Desktop Required', 'Template builder is only available on desktop.');
            return;
        }

        // Fetch latest templates to generate default name
        try {
            const response = await templatesApi.getAll();
            const templateList = response.templates || [];
            setTemplates(templateList);

            // Set initial data with generated name
            setBuilderMode('create');
            setCurrentWidgets([]);
            setEditingTemplate({
                id: '',
                name: generateDefaultName(templateList),
                description: '',
                categoryId: undefined,
                ownerId: '',
                widgets: [],
                isDraft: false,
                createdAt: '',
                updatedAt: '',
            } as Template);
            setShowBuilder(true);
        } catch (err) {
            logger.error('Failed to fetch templates:', { error: err });
            // Fall back to empty name
            setBuilderMode('create');
            setCurrentWidgets([]);
            setEditingTemplate(null);
            setShowBuilder(true);
        }
    }, [isMobile, showError, generateDefaultName]);

    // Open builder in save-current mode (with current dashboard widgets)
    const handleSaveCurrent = useCallback(async () => {
        if (isMobile) {
            showError('Desktop Required', 'Template builder is only available on desktop.');
            return;
        }
        try {
            // Fetch current dashboard widgets and templates in parallel
            const [widgetsResponse, templatesResponse] = await Promise.all([
                widgetsApi.getAll(),
                templatesApi.getAll(),
            ]);

            // API returns Widget[] (FramerrWidget format) - use directly, no conversion needed
            const widgets = widgetsResponse.widgets || [];
            const mobileLayoutMode = widgetsResponse.mobileLayoutMode || 'linked';
            const mobileWidgets = widgetsResponse.mobileWidgets || [];
            const templateList = templatesResponse.templates || [];
            setTemplates(templateList);

            setBuilderMode('save-current');
            setCurrentWidgets(widgets);
            setCurrentMobileLayoutMode(mobileLayoutMode);
            setCurrentMobileWidgets(mobileWidgets);
            // Set editingTemplate with generated name for save-current mode
            setEditingTemplate({
                id: '',
                name: generateDefaultName(templateList),
                description: '',
                categoryId: undefined,
                ownerId: '',
                widgets: [],
                isDraft: false,
                createdAt: '',
                updatedAt: '',
            } as Template);
            setShowBuilder(true);
        } catch (error) {
            logger.error('Failed to get current widgets:', { error });
            showError('Load Failed', 'Failed to load current dashboard.');
        }
    }, [isMobile, showError, generateDefaultName]);

    // Edit existing template
    const handleEdit = useCallback((template: Template) => {
        if (isMobile) {
            showError('Desktop Required', 'Template builder is only available on desktop.');
            return;
        }
        setBuilderMode('edit');
        setEditingTemplate(template);
        setShowBuilder(true);
    }, [isMobile, showError]);

    // Duplicate template (opens builder with copy)
    const handleDuplicate = useCallback((template: Template) => {
        if (isMobile) {
            showError('Desktop Required', 'Template builder is only available on desktop.');
            return;
        }
        setBuilderMode('duplicate');
        setEditingTemplate({
            ...template,
            name: `${template.name} (Copy)`,
            id: '', // Clear ID so it creates a new template
        });
        setShowBuilder(true);
    }, [isMobile, showError]);

    // Handle file import
    const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input so same file can be selected again
        e.target.value = '';

        try {
            const imported = await readFramerrFile(file);

            // Open builder with imported template data
            setBuilderMode('import');
            setEditingTemplate({
                id: '',
                name: imported.template.name + ' (Imported)',
                description: imported.template.description || '',
                categoryId: undefined,
                ownerId: '',
                widgets: imported.template.widgets,
                isDraft: false,
                mobileLayoutMode: imported.template.mobileLayoutMode,
                mobileWidgets: imported.template.mobileWidgets || undefined,
                createdAt: '',
                updatedAt: '',
            } as Template);
            setShowBuilder(true);
            success('Template Loaded', `"${imported.template.name}" is ready to review.`);
        } catch (err) {
            logger.error('Failed to import template:', { error: err });
            showError('Import Failed', 'Invalid template file. Please select a valid .framerr file.');
        }
    }, [success, showError]);

    // Revert to previous dashboard - opens confirmation dialog
    const handleRevert = useCallback(() => {
        setShowRevertConfirm(true);
    }, []);

    // Execute revert after confirmation
    const executeRevert = useCallback(async () => {
        try {
            setReverting(true);
            await templatesApi.revert();
            success('Dashboard Restored', 'Previous dashboard restored.');
            setHasBackup(false);

            // Trigger dashboard reload
            window.dispatchEvent(new CustomEvent('widgets-added'));

            // Close dialog
            setShowRevertConfirm(false);
        } catch (err) {
            logger.error('Failed to revert dashboard:', { error: err });
            showError('Revert Failed', 'Failed to restore previous dashboard.');
        } finally {
            setReverting(false);
        }
    }, [success, showError]);

    const handleBuilderClose = useCallback(() => {
        setShowBuilder(false);
        setEditingTemplate(null);
    }, []);

    const handleTemplateSaved = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
        success('Template Saved', 'Template saved.');
    }, [success]);

    const handleDraftSaved = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    // Get initial data for builder based on mode
    const getBuilderInitialData = useCallback(() => {
        // Helper to clean widget config - remove 'enabled' as it's redundant
        // (integration state is determined by integration settings, not widget config)
        const cleanConfig = (config: Record<string, unknown> | undefined) => {
            if (!config) return undefined;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { enabled, ...rest } = config;
            return Object.keys(rest).length > 0 ? rest : undefined;
        };

        if (builderMode === 'save-current') {
            // Widgets are already in FramerrWidget format from API - just clean configs
            return {
                name: editingTemplate?.name,
                widgets: currentWidgets.map(w => ({
                    id: w.id,
                    type: w.type,
                    layout: w.layout,
                    mobileLayout: w.mobileLayout,
                    config: cleanConfig(w.config),
                })),
                mobileLayoutMode: currentMobileLayoutMode,
                mobileWidgets: currentMobileWidgets.map(w => ({
                    id: w.id,
                    type: w.type,
                    layout: w.layout,
                    mobileLayout: w.mobileLayout,
                    config: cleanConfig(w.config),
                })),
            };
        }
        if (builderMode === 'create' && editingTemplate) {
            // Create mode with pre-generated default name
            return {
                name: editingTemplate.name,
            };
        }
        if ((builderMode === 'edit' || builderMode === 'duplicate' || builderMode === 'import') && editingTemplate) {
            return {
                // Include ID for edit mode so Step3 uses PUT instead of POST
                // For duplicate/import mode, id is cleared
                id: builderMode === 'edit' ? (editingTemplate.id || undefined) : undefined,
                name: editingTemplate.name,
                description: editingTemplate.description,
                categoryId: editingTemplate.categoryId,
                widgets: editingTemplate.widgets,
                isDefault: builderMode === 'edit' ? editingTemplate.isDefault : false,
                // Mobile layout independence - include from template
                mobileLayoutMode: editingTemplate.mobileLayoutMode,
                mobileWidgets: editingTemplate.mobileWidgets,
            };
        }
        return undefined;
    }, [builderMode, editingTemplate, currentWidgets, currentMobileLayoutMode, currentMobileWidgets]);

    return {
        // Auth & layout
        isAdmin,
        isMobile,

        // Builder state
        showBuilder,
        builderMode,
        editingTemplate,
        fileInputRef,

        // Backup state
        hasBackup,
        reverting,
        showRevertConfirm,

        // Sharing state
        sharingTemplate,
        setSharingTemplate,

        // Refresh trigger
        refreshTrigger,

        // Handlers - template actions
        handleCreateNew,
        handleSaveCurrent,
        handleEdit,
        handleDuplicate,
        handleImportFile,

        // Handlers - builder
        handleBuilderClose,
        handleTemplateSaved,
        handleDraftSaved,
        getBuilderInitialData,

        // Handlers - revert
        handleRevert,
        executeRevert,
        setShowRevertConfirm,

        // Notifications
        success,
        error: showError,
    };
}

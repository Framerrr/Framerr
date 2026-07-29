/**
 * useTemplateSettings - State management and handlers for template settings
 */

import { useState, useRef, useCallback } from 'react';
import { templatesApi, widgetsApi } from '../../../api/endpoints';
import type { Widget } from '../../../api/endpoints/widgets';
import { useLayout } from '../../../context/useLayout';
import { useAuth } from '../../../context/useAuth';
import { useNotifications } from '../../../context/notification';
import { useActiveDashboard } from '../../../context/ActiveDashboardContext';
import { readFramerrFile } from '../../../utils/templateExportImport';
import { generateWidgetId } from '../../../shared/grid/core/ops';
import { filterRegisteredWidgets } from '../../../widgets/registry';
import logger from '../../../utils/logger';
import type { Template, BuilderMode } from '../types';

interface UseTemplateSettingsReturn {
    isAdmin: boolean;
    isMobile: boolean;
    showBuilder: boolean;
    builderMode: BuilderMode;
    editingTemplate: Template | null;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    sharingTemplate: Template | null;
    setSharingTemplate: (template: Template | null) => void;
    refreshTrigger: number;
    handleCreateNew: () => Promise<void>;
    handleSaveCurrent: () => Promise<void>;
    handleEdit: (template: Template) => void;
    handleDuplicate: (template: Template) => void;
    handleImportFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleBuilderClose: () => void;
    handleTemplateSaved: () => void;
    handleDraftSaved: () => void;
    getBuilderInitialData: () => Record<string, unknown> | undefined;
    success: (title: string, message: string) => void;
    error: (title: string, message: string) => void;
}

export function useTemplateSettings(): UseTemplateSettingsReturn {
    const { user } = useAuth();
    const { isMobile } = useLayout();
    const { success, error: showError } = useNotifications();
    const isAdmin = user?.group === 'admin';
    const { activeDashboardId } = useActiveDashboard();

    const [showBuilder, setShowBuilder] = useState(false);
    const [builderMode, setBuilderMode] = useState<BuilderMode>('create');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentWidgets, setCurrentWidgets] = useState<Widget[]>([]);
    const [currentMobileLayoutMode, setCurrentMobileLayoutMode] = useState<'linked' | 'independent'>('linked');
    const [currentMobileWidgets, setCurrentMobileWidgets] = useState<Widget[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [sharingTemplate, setSharingTemplate] = useState<Template | null>(null);
    const [, setTemplates] = useState<Template[]>([]);

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

    const handleCreateNew = useCallback(async () => {
        if (isMobile) {
            showError('Desktop Required', 'Template builder is only available on desktop.');
            return;
        }

        try {
            const response = await templatesApi.getAll();
            const templateList = response.templates || [];
            setTemplates(templateList);

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
            setBuilderMode('create');
            setCurrentWidgets([]);
            setEditingTemplate(null);
            setShowBuilder(true);
        }
    }, [isMobile, showError, generateDefaultName]);

    const handleSaveCurrent = useCallback(async () => {
        if (isMobile) {
            showError('Desktop Required', 'Template builder is only available on desktop.');
            return;
        }
        try {
            if (!activeDashboardId) {
                showError('Dashboard Unavailable', 'No active dashboard selected.');
                return;
            }
            const [widgetsResponse, templatesResponse] = await Promise.all([
                widgetsApi.getAll(activeDashboardId),
                templatesApi.getAll(),
            ]);

            const widgets = widgetsResponse.widgets || [];
            const mobileLayoutMode = widgetsResponse.mobileLayoutMode || 'linked';
            const mobileWidgets = widgetsResponse.mobileWidgets || [];
            const templateList = templatesResponse.templates || [];
            setTemplates(templateList);

            setBuilderMode('save-current');
            setCurrentWidgets(widgets);
            setCurrentMobileLayoutMode(mobileLayoutMode);
            setCurrentMobileWidgets(mobileWidgets);
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
    }, [isMobile, showError, generateDefaultName, activeDashboardId]);

    const handleEdit = useCallback((template: Template) => {
        if (isMobile) {
            showError('Desktop Required', 'Template builder is only available on desktop.');
            return;
        }
        setBuilderMode('edit');
        setEditingTemplate(template);
        setShowBuilder(true);
    }, [isMobile, showError]);

    const handleDuplicate = useCallback((template: Template) => {
        if (isMobile) {
            showError('Desktop Required', 'Template builder is only available on desktop.');
            return;
        }
        setBuilderMode('duplicate');
        setEditingTemplate({
            ...template,
            name: `${template.name} (Copy)`,
            id: '',
        });
        setShowBuilder(true);
    }, [isMobile, showError]);

    const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        try {
            const imported = await readFramerrFile(file);
            const widgetsWithIds = imported.template.widgets.map(w => ({
                ...w,
                id: generateWidgetId(),
                config: w.config || {},
            }));
            const mobileWidgetsWithIds = imported.template.mobileWidgets
                ? imported.template.mobileWidgets.map(w => ({
                    ...w,
                    id: generateWidgetId(),
                    config: w.config || {},
                }))
                : undefined;

            setBuilderMode('import');
            setEditingTemplate({
                id: '',
                name: imported.template.name + ' (Imported)',
                description: imported.template.description || '',
                categoryId: undefined,
                ownerId: '',
                widgets: widgetsWithIds,
                isDraft: false,
                mobileLayoutMode: imported.template.mobileLayoutMode,
                mobileWidgets: mobileWidgetsWithIds,
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

    const getBuilderInitialData = useCallback(() => {
        const cleanConfig = (config: Record<string, unknown> | undefined) => {
            if (!config) return undefined;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { enabled, ...rest } = config;
            return Object.keys(rest).length > 0 ? rest : undefined;
        };

        if (builderMode === 'save-current') {
            const cleaned = currentWidgets.map(w => ({
                id: w.id,
                type: w.type,
                layout: w.layout,
                mobileLayout: w.mobileLayout,
                config: cleanConfig(w.config),
            }));
            const cleanedMobile = currentMobileWidgets.map(w => ({
                id: w.id,
                type: w.type,
                layout: w.layout,
                mobileLayout: w.mobileLayout,
                config: cleanConfig(w.config),
            }));
            return {
                name: editingTemplate?.name,
                widgets: filterRegisteredWidgets(cleaned, 'builder-save-current'),
                mobileLayoutMode: currentMobileLayoutMode,
                mobileWidgets: filterRegisteredWidgets(cleanedMobile, 'builder-save-current-mobile'),
            };
        }
        if (builderMode === 'create' && editingTemplate) {
            return { name: editingTemplate.name };
        }
        if ((builderMode === 'edit' || builderMode === 'duplicate' || builderMode === 'import') && editingTemplate) {
            return {
                id: builderMode === 'edit' ? (editingTemplate.id || undefined) : undefined,
                name: editingTemplate.name,
                description: editingTemplate.description,
                categoryId: editingTemplate.categoryId,
                widgets: filterRegisteredWidgets(editingTemplate.widgets || [], `builder-${builderMode}`),
                isDefault: builderMode === 'edit' ? editingTemplate.isDefault : false,
                mobileLayoutMode: editingTemplate.mobileLayoutMode,
                mobileWidgets: editingTemplate.mobileWidgets
                    ? filterRegisteredWidgets(editingTemplate.mobileWidgets, `builder-${builderMode}-mobile`)
                    : editingTemplate.mobileWidgets,
            };
        }
        return undefined;
    }, [builderMode, editingTemplate, currentWidgets, currentMobileLayoutMode, currentMobileWidgets]);

    return {
        isAdmin,
        isMobile,
        showBuilder,
        builderMode,
        editingTemplate,
        fileInputRef,
        sharingTemplate,
        setSharingTemplate,
        refreshTrigger,
        handleCreateNew,
        handleSaveCurrent,
        handleEdit,
        handleDuplicate,
        handleImportFile,
        handleBuilderClose,
        handleTemplateSaved,
        handleDraftSaved,
        getBuilderInitialData,
        success,
        error: showError,
    };
}

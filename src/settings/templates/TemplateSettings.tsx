/**
 * TemplateSettings - Templates section in Settings (thin orchestrator)
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { SettingsPage, SettingsSection } from '../../shared/ui/settings';
import TemplateBuilder from './builder/TemplateBuilder';
import TemplateList from './components/TemplateList';
import { useTemplateSettings } from './hooks/useTemplateSettings';
import { ActionsSection } from './sections/ActionsSection';
import { ShareModal } from './components/ShareModal';
import type { Template, TemplateSettingsProps } from './types';

export const TemplateSettings: React.FC<TemplateSettingsProps> = ({ className = '' }) => {
    const {
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
        error,
    } = useTemplateSettings();

    return (
        <SettingsPage
            title="Templates"
            description="Create and manage reusable dashboard layouts"
            className={className}
        >
            <ActionsSection
                isMobile={isMobile}
                fileInputRef={fileInputRef}
                onCreateNew={handleCreateNew}
                onSaveCurrent={handleSaveCurrent}
                onImportFile={handleImportFile}
            />

            <SettingsSection title="Your Templates" icon={FileText}>
                <TemplateList
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onShare={setSharingTemplate}
                    isAdmin={isAdmin}
                    refreshTrigger={refreshTrigger}
                />
            </SettingsSection>

            <TemplateBuilder
                isOpen={showBuilder}
                onClose={handleBuilderClose}
                mode={(builderMode === 'edit') ? 'edit' : (builderMode === 'duplicate' || builderMode === 'import') ? 'create' : builderMode}
                initialData={getBuilderInitialData()}
                editingTemplateId={builderMode === 'edit' ? editingTemplate?.id : undefined}
                onSave={handleTemplateSaved}
                onShare={(template) => {
                    setSharingTemplate(template as unknown as Template);
                }}
                onDraftSaved={handleDraftSaved}
                isAdmin={isAdmin}
            />

            <ShareModal
                template={sharingTemplate}
                isAdmin={isAdmin}
                onClose={() => setSharingTemplate(null)}
                onShareComplete={() => {
                    setSharingTemplate(null);
                    handleDraftSaved();
                    success('Template Shared', `"${sharingTemplate?.name}" sharing settings updated.`);
                }}
                onSuccess={success}
                onError={error}
            />
        </SettingsPage>
    );
};

export default TemplateSettings;

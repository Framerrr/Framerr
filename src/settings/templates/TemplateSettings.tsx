/**
 * TemplateSettings - Templates section in Settings (thin orchestrator)
 * 
 * Features:
 * - Create New Template button
 * - Save Current Dashboard as Template button
 * - Template list with management actions
 * - Revert to previous dashboard (if backup exists)
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { ConfirmDialog } from '../../shared/ui';
import { SettingsPage, SettingsSection } from '../../shared/ui/settings';
import TemplateBuilder from './builder/TemplateBuilder';
import TemplateList from './components/TemplateList';
import { useTemplateSettings } from './hooks/useTemplateSettings';
import { ActionsSection } from './sections/ActionsSection';
import { ShareModal } from './components/ShareModal';
import type { Template, TemplateSettingsProps } from './types';

export const TemplateSettings: React.FC<TemplateSettingsProps> = ({ className = '' }) => {
    const {
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
        error,
    } = useTemplateSettings();

    return (
        <SettingsPage
            title="Templates"
            description="Create and manage reusable dashboard layouts"
            className={className}
        >
            {/* Template Actions Section */}
            <ActionsSection
                isMobile={isMobile}
                hasBackup={hasBackup}
                reverting={reverting}
                fileInputRef={fileInputRef}
                onCreateNew={handleCreateNew}
                onSaveCurrent={handleSaveCurrent}
                onImportFile={handleImportFile}
                onRevert={handleRevert}
            />

            {/* Your Templates Section */}
            <SettingsSection title="Your Templates" icon={FileText}>
                <TemplateList
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onShare={setSharingTemplate}
                    isAdmin={isAdmin}
                    refreshTrigger={refreshTrigger}
                />
            </SettingsSection>

            {/* Template Builder Modal */}
            <TemplateBuilder
                isOpen={showBuilder}
                onClose={handleBuilderClose}
                mode={(builderMode === 'edit') ? 'edit' : (builderMode === 'duplicate' || builderMode === 'import') ? 'create' : builderMode}
                initialData={getBuilderInitialData()}
                editingTemplateId={builderMode === 'edit' ? editingTemplate?.id : undefined}
                onSave={handleTemplateSaved}
                onShare={(template) => {
                    // After saving, open share/export modal with the saved template
                    setSharingTemplate(template as unknown as Template);
                }}
                onDraftSaved={handleDraftSaved}
                isAdmin={isAdmin}
            />

            {/* Share Template Modal */}
            <ShareModal
                template={sharingTemplate}
                isAdmin={isAdmin}
                onClose={() => setSharingTemplate(null)}
                onShareComplete={() => {
                    setSharingTemplate(null);
                    handleDraftSaved(); // Triggers refresh
                    success('Template Shared', `"${sharingTemplate?.name}" sharing settings updated.`);
                }}
                onSuccess={success}
                onError={error}
            />

            {/* Revert Confirmation Dialog */}
            <ConfirmDialog
                open={showRevertConfirm}
                onOpenChange={(open) => !open && setShowRevertConfirm(false)}
                onConfirm={executeRevert}
                title="Revert Dashboard"
                message={`Revert to your previous dashboard?

This will restore the dashboard you had before applying a template.`}
                confirmLabel="Revert"
                variant="danger"
                loading={reverting}
            />
        </SettingsPage>
    );
};

export default TemplateSettings;

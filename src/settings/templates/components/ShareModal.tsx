/**
 * ShareModal - Template sharing and export modal
 * 
 * Displays:
 * - Admin: Sharing controls + export option
 * - Non-admin: Export only
 * 
 * Manages sharing state and saves when modal is saved.
 * Note: Integration binding is now done in the Template Builder, not here.
 */

import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Modal, Checkbox, Button } from '../../../shared/ui';
import TemplateSharingDropdown, { SharingMode } from './TemplateSharingDropdown';
import { templateHasSensitiveWidgets, exportTemplate } from '../../../utils/templateExportImport';
import type { Template } from '../types';
import { templatesApi } from '../../../api/endpoints';
import logger from '../../../utils/logger';

interface ShareModalProps {
    template: Template | null;
    isAdmin: boolean;
    onClose: () => void;
    onShareComplete: () => void;
    onSuccess: (title: string, message: string) => void;
    onError?: (title: string, message: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
    template,
    isAdmin,
    onClose,
    onShareComplete,
    onSuccess,
    onError,
}) => {
    const [includeConfigs, setIncludeConfigs] = useState(false);

    // Sharing state (managed here, passed to dropdown)
    const [sharingMode, setSharingMode] = useState<SharingMode>('none');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [initialMode, setInitialMode] = useState<SharingMode>('none');
    const [initialUserIds, setInitialUserIds] = useState<string[]>([]);
    const [loadingShares, setLoadingShares] = useState(true);
    const [saving, setSaving] = useState(false);

    // Fetch current shares on mount
    useEffect(() => {
        if (!template) return;

        const fetchShares = async () => {
            setLoadingShares(true);
            try {
                const response = await templatesApi.getShares(template.id);

                const copyOwners = response.users || [];
                const totalNonAdminUsers = response.totalNonAdminUsers || 0;
                const actualUserIds = copyOwners.map((u: { id: string }) => u.id);

                // Reality-based mode calculation
                if (actualUserIds.length > 0 && actualUserIds.length === totalNonAdminUsers) {
                    setSharingMode('everyone');
                    setSelectedUserIds(actualUserIds);
                    setInitialMode('everyone');
                    setInitialUserIds(actualUserIds);
                } else if (actualUserIds.length > 0) {
                    setSharingMode('users');
                    setSelectedUserIds(actualUserIds);
                    setInitialMode('users');
                    setInitialUserIds(actualUserIds);
                } else {
                    setSharingMode('none');
                    setSelectedUserIds([]);
                    setInitialMode('none');
                    setInitialUserIds([]);
                }
            } catch (error) {
                logger.debug('No shares found or error fetching shares', { error });
            } finally {
                setLoadingShares(false);
            }
        };

        fetchShares();
    }, [template?.id]);

    if (!template) return null;

    const hasChanges = sharingMode !== initialMode ||
        JSON.stringify(selectedUserIds.sort()) !== JSON.stringify(initialUserIds.sort());

    const handleSave = async (): Promise<void> => {
        if (!hasChanges) {
            onClose();
            return;
        }

        setSaving(true);
        try {
            // Remove all existing shares
            const currentShares = initialUserIds.length > 0
                ? initialUserIds.map(id => ({ sharedWith: id }))
                : initialMode === 'everyone' ? [{ sharedWith: 'everyone' }] : [];

            for (const share of currentShares) {
                await templatesApi.unshare(template.id, share.sharedWith);
            }

            // Add new shares based on mode
            // Note: Integration binding is now handled per-widget in the template builder,
            // so the backend automatically shares integrations based on widget.shareIntegration
            if (sharingMode === 'everyone') {
                await templatesApi.share(template.id, 'everyone');
            } else if (sharingMode === 'users' && selectedUserIds.length > 0) {
                for (const userId of selectedUserIds) {
                    await templatesApi.share(template.id, userId);
                }
            }

            logger.info('Template sharing updated', { templateId: template.id, mode: sharingMode, userCount: selectedUserIds.length });
            onShareComplete();
            onClose();
        } catch (error) {
            logger.error('Failed to update template sharing', { error });
            onError?.('Share Failed', 'Failed to update template sharing. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={!!template}
            onOpenChange={(open) => !open && onClose()}
            size="sm"
        >
            <Modal.Header title={isAdmin ? `Share "${template.name}"` : `Export "${template.name}"`} />
            <Modal.Body>
                <div className="space-y-4">
                    {/* Admin: Sharing controls */}
                    {isAdmin && (
                        <>
                            <p className="text-sm text-theme-secondary">
                                Choose who can access this template.
                            </p>
                            {!loadingShares && (
                                <TemplateSharingDropdown
                                    mode={sharingMode}
                                    selectedUserIds={selectedUserIds}
                                    onModeChange={setSharingMode}
                                    onUserSelectionChange={setSelectedUserIds}
                                />
                            )}
                            {/* Sharing disclaimer */}
                            <p className="text-xs text-theme-tertiary mt-2">
                                Selected widgets and integrations will be shared with these users. This does <span className="text-info">not</span> apply to exported templates.
                            </p>
                            <div className="border-t border-theme pt-4">
                                <p className="text-xs text-theme-tertiary mb-2">Or export to file</p>
                            </div>
                        </>
                    )}

                    {/* Export section - visible to everyone */}
                    <div className="space-y-3">
                        {!isAdmin && (
                            <p className="text-sm text-theme-secondary">
                                Download this template as a file.
                            </p>
                        )}

                        {/* Sensitive widgets checkbox */}
                        {templateHasSensitiveWidgets(template.widgets) && (
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-theme-tertiary cursor-pointer hover:bg-theme-hover transition-colors">
                                <Checkbox
                                    checked={includeConfigs}
                                    onCheckedChange={(checked) => setIncludeConfigs(checked === true)}
                                />
                                <div>
                                    <span className="text-sm text-theme-primary">Include personal content</span>
                                    <p className="text-xs text-theme-tertiary">Links, HTML content, and other settings</p>
                                </div>
                            </label>
                        )}

                        <Button
                            variant="secondary"
                            icon={Download}
                            className="w-full"
                            onClick={() => {
                                exportTemplate(template, includeConfigs);
                                onSuccess('Template Exported', `"${template.name}" saved as .framerr file.`);
                            }}
                        >
                            Export Template
                        </Button>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                {isAdmin && (
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        loading={saving}
                        disabled={!hasChanges}
                    >
                        Save Changes
                    </Button>
                )}
            </Modal.Footer>
        </Modal>
    );
};

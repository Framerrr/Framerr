/**
 * NewDashboardModal — create blank, clone active, or from template
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Input, Select } from '../../../shared/ui';
import { useCreateDashboard } from '../../../api/hooks/useDashboards';
import { useTemplates } from '../../../api/hooks';
import { useActiveDashboard } from '../../../context/ActiveDashboardContext';
import { useNotifications } from '../../../context/notification';
import logger from '../../../utils/logger';
import type { CreateDashboardSource } from '../../../api/endpoints/dashboards';

type SourceKind = 'blank' | 'clone' | 'template';

export interface NewDashboardModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NewDashboardModal({ open, onOpenChange }: NewDashboardModalProps): React.JSX.Element {
    const { activeDashboardId, switchDashboard, dashboards, homeDashboardId } = useActiveDashboard();
    const createMutation = useCreateDashboard();
    const { data: templatesData } = useTemplates();
    const { error: showError } = useNotifications();

    const activeName = useMemo(
        () => dashboards.find(d => d.id === activeDashboardId)?.name ?? 'Current dashboard',
        [dashboards, activeDashboardId]
    );

    const [name, setName] = useState('');
    const [source, setSource] = useState<SourceKind>('blank');
    const [templateId, setTemplateId] = useState('');

    const templateOptions = templatesData?.templates?.filter(t => !t.isDraft) ?? [];

    useEffect(() => {
        if (!open) return;
        setName('');
        setSource('blank');
        const drafts = templatesData?.templates?.filter(t => !t.isDraft) ?? [];
        setTemplateId(drafts[0]?.id ?? '');
    }, [open, templatesData?.templates]);

    const handleCreate = async (): Promise<void> => {
        let sourcePayload: CreateDashboardSource | undefined;
        if (source === 'clone') {
            if (!activeDashboardId) {
                showError('Unavailable', 'No dashboard to clone.');
                return;
            }
            sourcePayload = { type: 'clone', dashboardId: activeDashboardId };
        } else if (source === 'template') {
            if (!templateId) {
                showError('Select template', 'Choose a template to copy from.');
                return;
            }
            sourcePayload = { type: 'template', templateId };
        } else {
            sourcePayload = { type: 'blank' };
        }

        try {
            const result = await createMutation.mutateAsync({
                name: name.trim() || undefined,
                source: sourcePayload,
            });
            const newId = result.dashboard.id;
            onOpenChange(false);
            switchDashboard(newId);
        } catch (err) {
            logger.error('Failed to create dashboard', { error: err });
            showError('Create Failed', 'Could not create dashboard. Please try again.');
        }
    };

    return (
        <Modal open={open} onOpenChange={onOpenChange} size="md">
            <Modal.Header title="New Dashboard" />
            <Modal.Body className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-theme-tertiary mb-2">Name</label>
                    <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Dashboard"
                    />
                </div>

                <fieldset className="space-y-2">
                    <legend className="text-xs font-medium text-theme-tertiary mb-2">Start from</legend>
                    {(
                        [
                            { id: 'blank' as const, label: 'Blank dashboard' },
                            { id: 'clone' as const, label: `Clone current (${activeName})` },
                            { id: 'template' as const, label: 'From template' },
                        ] as const
                    ).map(opt => (
                        <label
                            key={opt.id}
                            className="flex items-center gap-2 text-sm text-theme-primary cursor-pointer rounded-lg px-2 py-2 hover:bg-theme-hover"
                        >
                            <input
                                type="radio"
                                name="dashboard-source"
                                checked={source === opt.id}
                                onChange={() => setSource(opt.id)}
                                className="accent-[var(--accent)]"
                            />
                            {opt.label}
                        </label>
                    ))}
                </fieldset>

                {source === 'template' && (
                    <Select value={templateId} onValueChange={setTemplateId}>
                        <Select.Trigger className="w-full">
                            <Select.Value placeholder="Select template…" />
                        </Select.Trigger>
                        <Select.Content>
                            {templateOptions.map(t => (
                                <Select.Item key={t.id} value={t.id}>
                                    {t.name}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select>
                )}

                {homeDashboardId && source === 'blank' && (
                    <p className="text-xs text-theme-tertiary">
                        Your Home dashboard remains {dashboards.find(d => d.id === homeDashboardId)?.name ?? 'unchanged'}.
                    </p>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={() => void handleCreate()} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating…' : 'Create'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

export default NewDashboardModal;

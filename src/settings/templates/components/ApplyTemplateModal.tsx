/**
 * ApplyTemplateModal — choose dashboard target before applying a template
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Home } from 'lucide-react';
import { Modal, Button, Select, Input } from '../../../shared/ui';
import { templatesApi } from '../../../api/endpoints';
import { useDashboards } from '../../../api/hooks/useDashboards';
import { useActiveDashboard } from '../../../context/ActiveDashboardContext';
import { useNotifications } from '../../../context/notification';
import { dispatchCustomEvent, CustomEventNames } from '../../../types/events';
import logger from '../../../utils/logger';

const NEW_DASHBOARD_VALUE = '__new_dashboard__';

export interface ApplyTemplateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    templateId: string;
    templateName: string;
    onApplied?: () => void;
}

export function ApplyTemplateModal({
    open,
    onOpenChange,
    templateId,
    templateName,
    onApplied,
}: ApplyTemplateModalProps): React.JSX.Element {
    const { data } = useDashboards();
    const { activeDashboardId, switchDashboard } = useActiveDashboard();
    const { success, error: showError } = useNotifications();

    const dashboards = data?.dashboards ?? [];
    const defaultDashboardId = activeDashboardId ?? data?.homeDashboardId ?? dashboards[0]?.id ?? '';

    const [targetValue, setTargetValue] = useState(defaultDashboardId);
    const [newName, setNewName] = useState(templateName);
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        if (!open) return;
        setTargetValue(defaultDashboardId || NEW_DASHBOARD_VALUE);
        setNewName(templateName);
    }, [open, defaultDashboardId, templateName]);

    const isNewTarget = targetValue === NEW_DASHBOARD_VALUE;

    const targetLabel = useMemo(() => {
        if (isNewTarget) return 'New dashboard';
        return dashboards.find(d => d.id === targetValue)?.name ?? 'Dashboard';
    }, [dashboards, isNewTarget, targetValue]);

    const handleApply = async (): Promise<void> => {
        try {
            setApplying(true);
            const target = isNewTarget
                ? { createNew: true as const, name: newName.trim() || templateName }
                : { dashboardId: targetValue };

            const result = await templatesApi.apply(templateId, target);
            success('Template Applied', `"${templateName}" applied to ${targetLabel}.`);
            dispatchCustomEvent(CustomEventNames.WIDGETS_ADDED);
            switchDashboard(result.dashboardId);
            onOpenChange(false);
            onApplied?.();
        } catch (err) {
            logger.error('Failed to apply template', { error: err });
            showError('Apply Failed', 'Failed to apply template. Please try again.');
        } finally {
            setApplying(false);
        }
    };

    return (
        <Modal open={open} onOpenChange={onOpenChange} size="md">
            <Modal.Header title="Apply Template" />
            <Modal.Body>
                <p className="text-sm text-theme-secondary mb-4">
                    Apply &quot;{templateName}&quot; to a dashboard. The target dashboard&apos;s current
                    layout will be <span className="text-theme-primary font-medium">replaced and cannot be undone</span>.
                </p>

                <label className="block text-xs font-medium text-theme-tertiary mb-2">
                    Target dashboard
                </label>
                <Select value={targetValue} onValueChange={setTargetValue}>
                    <Select.Trigger className="w-full">
                        <Select.Value placeholder="Choose dashboard…" />
                    </Select.Trigger>
                    <Select.Content>
                        {dashboards.map(d => (
                            <Select.Item key={d.id} value={d.id}>
                                <span className="flex items-center gap-1.5 min-w-0">
                                    <span className="truncate">{d.name}</span>
                                    {d.id === data?.homeDashboardId && (
                                        <Home
                                            size={14}
                                            className="text-accent shrink-0"
                                            aria-label="Home"
                                        />
                                    )}
                                </span>
                            </Select.Item>
                        ))}
                        <Select.Item value={NEW_DASHBOARD_VALUE}>
                            New dashboard from template
                        </Select.Item>
                    </Select.Content>
                </Select>

                {isNewTarget && (
                    <div className="mt-4">
                        <label className="block text-xs font-medium text-theme-tertiary mb-2">
                            New dashboard name
                        </label>
                        <Input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="Dashboard name"
                        />
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={applying}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={() => void handleApply()} disabled={applying || (!isNewTarget && !targetValue)}>
                    {applying ? 'Applying…' : 'Apply'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

export default ApplyTemplateModal;

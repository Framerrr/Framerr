/**
 * DashboardsSection — manage dashboards on Settings → Dashboard → General
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    Copy,
    Home,
    LayoutGrid,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import {
    Button,
    ConfirmDialog,
    Input,
    Switch,
} from '../../../shared/ui';
import { SettingsSection, SettingsItem } from '../../../shared/ui/settings';
import {
    useDashboards,
    useUpdateDashboard,
    useDeleteDashboard,
    useSetDashboardPreferences,
} from '../../../api/hooks/useDashboards';
import { useActiveDashboard } from '../../../context/ActiveDashboardContext';
import { useNotifications } from '../../../context/notification';
import { NewDashboardModal } from '../../../app/dashboard/components/NewDashboardModal';
import IconPicker from '../../../components/IconPicker';
import { LoadingSpinner } from '@/shared/ui';
import logger from '../../../utils/logger';
import { copyTextToClipboard } from '../../../shared/utils/clipboard';
import type { DashboardMeta } from '../../../api/endpoints/dashboards';

export function DashboardsSection(): React.JSX.Element {
    const { data, isLoading } = useDashboards();
    const { homeDashboardId, rememberLastDashboard } = useActiveDashboard();
    const updateDashboard = useUpdateDashboard();
    const deleteDashboard = useDeleteDashboard();
    const setPrefs = useSetDashboardPreferences();
    const { success, error: showError } = useNotifications();

    const [newOpen, setNewOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<DashboardMeta | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const dashboards = data?.dashboards ?? [];
    const homeId = data?.homeDashboardId ?? homeDashboardId ?? '';

    const deleteMessage = useMemo(() => {
        if (!deleteTarget) return '';
        const count = deleteTarget.widgetCount ?? 0;
        const widgetLine = `This dashboard has ${count} widget${count === 1 ? '' : 's'}.`;
        const isHome = deleteTarget.id === homeId;
        const isLast = dashboards.length <= 1;

        if (isLast) {
            return `${widgetLine}\n\nThis is your only dashboard. After deletion, a blank "Dashboard" will be created and set as Home.`;
        }
        if (isHome) {
            return `${widgetLine}\n\nThis is your Home dashboard. Another dashboard will become Home automatically.`;
        }
        return `${widgetLine}\n\nThis cannot be undone.`;
    }, [deleteTarget, homeId, dashboards.length]);

    const startRename = (id: string, currentName: string): void => {
        setEditingId(id);
        setEditName(currentName);
    };

    const commitRename = useCallback(
        async (id: string, original: string): Promise<void> => {
            const trimmed = editName.trim();
            setEditingId(null);
            if (!trimmed || trimmed === original) return;
            try {
                await updateDashboard.mutateAsync({ id, data: { name: trimmed } });
            } catch (err) {
                logger.error('Failed to rename dashboard', { error: err });
                showError('Rename Failed', 'Could not rename dashboard.');
            }
        },
        [editName, updateDashboard, showError]
    );

    const handleCopyLink = async (id: string): Promise<void> => {
        const url = `${window.location.origin}/#dashboard/${id}`;
        const ok = await copyTextToClipboard(url);
        if (ok) {
            success('Link Copied', 'Dashboard link copied to clipboard.');
        } else {
            showError('Copy Failed', 'Could not copy link.');
        }
    };

    const handleSetHome = async (id: string): Promise<void> => {
        try {
            await setPrefs.mutateAsync({ homeDashboardId: id });
        } catch (err) {
            logger.error('Failed to set home dashboard', { error: err });
            showError('Update Failed', 'Could not set Home dashboard.');
        }
    };

    const handleIconChange = async (id: string, iconName: string): Promise<void> => {
        const icon = iconName === 'LayoutDashboard' ? null : iconName;
        try {
            await updateDashboard.mutateAsync({ id, data: { icon } });
        } catch (err) {
            logger.error('Failed to update dashboard icon', { error: err });
            showError('Update Failed', 'Could not update dashboard icon.');
        }
    };

    const handleRememberLast = async (checked: boolean): Promise<void> => {
        try {
            await setPrefs.mutateAsync({ rememberLastDashboard: checked });
        } catch (err) {
            logger.error('Failed to update remember-last preference', { error: err });
            showError('Update Failed', 'Could not update preference.');
        }
    };

    const executeDelete = async (): Promise<void> => {
        if (!deleteTarget) return;
        try {
            setDeleteLoading(true);
            await deleteDashboard.mutateAsync(deleteTarget.id);
            success('Dashboard Deleted', `"${deleteTarget.name}" was deleted.`);
            setDeleteTarget(null);
        } catch (err) {
            logger.error('Failed to delete dashboard', { error: err });
            showError('Delete Failed', 'Could not delete dashboard.');
        } finally {
            setDeleteLoading(false);
        }
    };

    if (isLoading) {
        return (
            <SettingsSection title="Your Dashboards" icon={LayoutGrid}>
                <div className="flex justify-center py-6">
                    <LoadingSpinner size="md" />
                </div>
            </SettingsSection>
        );
    }

    return (
        <>
            <SettingsSection title="Your Dashboards" icon={LayoutGrid}>
                <div className="space-y-2 mb-4">
                    {dashboards.map(d => (
                        <div
                            key={d.id}
                            className="flex flex-wrap items-center gap-x-2 gap-y-2 p-3 rounded-xl border border-theme bg-theme-secondary/30"
                        >
                            <div className="flex min-w-[min(100%,calc(3.5rem+10ch))] flex-1 basis-[10ch] items-center gap-2 overflow-hidden">
                                <div className="shrink-0">
                                    <IconPicker
                                        compact
                                        value={d.icon || 'LayoutDashboard'}
                                        onChange={iconName => void handleIconChange(d.id, iconName)}
                                    />
                                </div>
                                <Home
                                    size={14}
                                    className={
                                        d.id === homeId
                                            ? 'text-accent shrink-0'
                                            : 'invisible shrink-0 pointer-events-none'
                                    }
                                    aria-label={d.id === homeId ? 'Home' : undefined}
                                    aria-hidden={d.id !== homeId}
                                />
                                {editingId === d.id ? (
                                    <Input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        onBlur={() => void commitRename(d.id, d.name)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') void commitRename(d.id, d.name);
                                            if (e.key === 'Escape') setEditingId(null);
                                        }}
                                        autoFocus
                                        className="min-w-0 flex-1"
                                    />
                                ) : (
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-theme-primary">
                                        {d.name}
                                    </span>
                                )}
                            </div>
                            <div className="ml-auto flex shrink-0 items-center gap-2">
                                {d.id === homeId && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="invisible pointer-events-none"
                                        tabIndex={-1}
                                        aria-hidden
                                    >
                                        <Home size={14} />
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startRename(d.id, d.name)}
                                    aria-label="Rename"
                                >
                                    <Pencil size={14} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void handleCopyLink(d.id)}
                                    aria-label="Copy link"
                                >
                                    <Copy size={14} />
                                </Button>
                                {d.id !== homeId && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => void handleSetHome(d.id)}
                                        aria-label="Set Home"
                                        title="Set Home"
                                    >
                                        <Home size={14} />
                                    </Button>
                                )}
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => setDeleteTarget(d)}
                                    aria-label="Delete"
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <Button
                    variant="secondary"
                    onClick={() => setNewOpen(true)}
                    className="w-full sm:w-auto flex items-center gap-2"
                >
                    <Plus size={16} />
                    New Dashboard
                </Button>

                <SettingsItem
                    label="Remember last dashboard"
                    description="When enabled, return to the dashboard you used last. When off, new visits open on Home."
                    icon={LayoutGrid}
                    iconColor="text-accent"
                    className="mt-6"
                >
                    <Switch
                        checked={data?.rememberLastDashboard ?? rememberLastDashboard}
                        onCheckedChange={checked => void handleRememberLast(checked)}
                    />
                </SettingsItem>
            </SettingsSection>

            <NewDashboardModal open={newOpen} onOpenChange={setNewOpen} />

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={open => !open && setDeleteTarget(null)}
                onConfirm={() => void executeDelete()}
                title="Delete Dashboard"
                message={deleteMessage}
                confirmLabel="Delete"
                variant="danger"
                loading={deleteLoading}
            />
        </>
    );
}

export default DashboardsSection;

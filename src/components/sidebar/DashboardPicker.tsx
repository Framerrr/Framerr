/**
 * DashboardPicker — shared list for desktop dropdown and mobile sheet
 *
 * New-dashboard flow: prefer `onRequestNew` so the parent can host
 * `NewDashboardModal` outside the dropdown/sheet (which unmount on close).
 */
import React, { useState } from 'react';
import { Check, Home, Plus } from 'lucide-react';
import { DropdownMenu } from '../../shared/ui/DropdownMenu/DropdownMenu';
import { useActiveDashboard } from '../../context/ActiveDashboardContext';
import { useSharedSidebar } from '@/app/sidebar/context/useSharedSidebar';
import { NewDashboardModal } from '../../app/dashboard/components/NewDashboardModal';
import { LoadingSpinner } from '@/shared/ui';

export type DashboardPickerVariant = 'menu' | 'list';

export interface DashboardPickerProps {
    variant: DashboardPickerVariant;
    onRequestClose?: () => void;
    /** Parent-owned create flow (required when picker unmounts with its host). */
    onRequestNew?: () => void;
}

function DashboardPickerRows({
    variant,
    onSelect,
    onNewDashboard,
}: {
    variant: DashboardPickerVariant;
    onSelect: (id: string) => void;
    onNewDashboard: () => void;
}): React.JSX.Element {
    const { dashboards, homeDashboardId, activeDashboardId, isLoading } = useActiveDashboard();
    const { renderIcon } = useSharedSidebar();

    if (isLoading) {
        return (
            <div className="flex justify-center py-4">
                <LoadingSpinner size="sm" />
            </div>
        );
    }

    const rowClass =
        variant === 'list'
            ? // Horizontal inset so hover wash doesn't meet the pill edge
              'w-[calc(100%-1.25rem)] mx-2.5 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-theme-primary hover:bg-[rgba(59,130,246,0.12)] active:bg-[rgba(59,130,246,0.18)] transition-colors'
            : '';

    // Current dashboard first; keep relative order for the rest.
    const orderedDashboards = [...dashboards].sort((a, b) => {
        if (a.id === activeDashboardId) return -1;
        if (b.id === activeDashboardId) return 1;
        return 0;
    });

    const renderRow = (id: string, label: React.ReactNode, isActive: boolean, onClick: () => void) => {
        const content = (
            <>
                <span className="flex-1 truncate text-left">{label}</span>
                {isActive && <Check size={16} className="text-accent shrink-0" />}
            </>
        );

        if (variant === 'menu') {
            return (
                <DropdownMenu.Item
                    key={id}
                    onSelect={() => {
                        onClick();
                    }}
                >
                    {content}
                </DropdownMenu.Item>
            );
        }

        return (
            <button key={id} type="button" className={rowClass} onClick={onClick}>
                {content}
            </button>
        );
    };

    return (
        <>
            {orderedDashboards.map(d =>
                renderRow(
                    d.id,
                    <span className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 text-theme-tertiary">
                            {renderIcon(d.icon || 'LayoutDashboard', 16)}
                        </span>
                        <span className="truncate">{d.name}</span>
                        {d.id === homeDashboardId && (
                            <Home
                                size={12}
                                className="text-theme-tertiary shrink-0"
                                aria-label="Home"
                            />
                        )}
                    </span>,
                    d.id === activeDashboardId,
                    () => onSelect(d.id)
                )
            )}

            {variant === 'menu' ? (
                <>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item
                        onSelect={() => {
                            onNewDashboard();
                        }}
                    >
                        <Plus size={16} className="text-accent" />
                        New Dashboard
                    </DropdownMenu.Item>
                </>
            ) : (
                <>
                    <div
                        className="h-px my-2 mx-4"
                        style={{ backgroundColor: 'var(--border-accent)' }}
                    />
                    <button type="button" className={rowClass} onClick={onNewDashboard}>
                        <Plus size={16} className="text-accent" />
                        <span className="font-medium">New Dashboard</span>
                    </button>
                </>
            )}
        </>
    );
}

export function DashboardPicker({
    variant,
    onRequestClose,
    onRequestNew,
}: DashboardPickerProps): React.JSX.Element {
    const { switchDashboard } = useActiveDashboard();
    const [newOpen, setNewOpen] = useState(false);
    const parentOwnsNew = typeof onRequestNew === 'function';

    const handleSelect = (id: string): void => {
        switchDashboard(id);
        onRequestClose?.();
    };

    const handleNew = (): void => {
        if (parentOwnsNew) {
            onRequestNew();
            return;
        }
        setNewOpen(true);
        onRequestClose?.();
    };

    return (
        <>
            {variant === 'menu' ? (
                <DashboardPickerRows variant="menu" onSelect={handleSelect} onNewDashboard={handleNew} />
            ) : (
                <div className="flex flex-col py-2">
                    <DashboardPickerRows variant="list" onSelect={handleSelect} onNewDashboard={handleNew} />
                </div>
            )}
            {!parentOwnsNew && <NewDashboardModal open={newOpen} onOpenChange={setNewOpen} />}
        </>
    );
}

export default DashboardPicker;

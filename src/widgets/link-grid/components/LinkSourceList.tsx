import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ActionSelect } from '../../../shared/ui/ActionSelect/ActionSelect';
import { ConfirmButton } from '../../../shared/ui';
import { getIconComponent } from '../../../utils/iconUtils';

export interface LinkSourceListItem {
    id: string;
    title: string;
    icon: string;
    subtitle?: string;
}

interface LinkSourceListProps<T extends LinkSourceListItem> {
    items: T[];
    triggerLabel: string;
    triggerIcon: LucideIcon;
    countLabel: (n: number) => string;
    emptyLabel: string;
    searchPlaceholder: string;
    onSelect: (item: T) => void;
    onDelete?: (id: string) => void;
    isLoading?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Keep the trigger visible even when `items` is empty (e.g. lazy harvest). */
    showWhenEmpty?: boolean;
}

export function LinkSourceList<T extends LinkSourceListItem>({
    items,
    triggerLabel,
    triggerIcon: TriggerIcon,
    countLabel,
    emptyLabel,
    searchPlaceholder,
    onSelect,
    onDelete,
    isLoading = false,
    onOpenChange,
    showWhenEmpty = false,
}: LinkSourceListProps<T>): React.JSX.Element | null {
    const [search, setSearch] = useState('');

    const filteredItems = items.filter(item =>
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(search.toLowerCase())),
    );

    if (items.length === 0 && !isLoading && !showWhenEmpty) return null;

    return (
        <ActionSelect closeOnScroll={false} onOpenChange={onOpenChange}>
            <ActionSelect.Trigger className="w-full block">
                <button
                    type="button"
                    className="
                        w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
                        border transition-colors
                        border-theme text-theme-secondary bg-theme-tertiary
                    "
                >
                    <TriggerIcon size={14} className="flex-shrink-0" />
                    <span className="flex-1 text-left">{triggerLabel}</span>
                    <span className="text-xs text-theme-tertiary">
                        {isLoading ? 'Loading…' : countLabel(items.length)}
                    </span>
                </button>
            </ActionSelect.Trigger>
            <ActionSelect.Content>
                <ActionSelect.Search
                    value={search}
                    onChange={setSearch}
                    placeholder={searchPlaceholder}
                />
                <ActionSelect.Items>
                    {isLoading ? (
                        <ActionSelect.Empty>Loading…</ActionSelect.Empty>
                    ) : filteredItems.length === 0 ? (
                        <ActionSelect.Empty>
                            {search ? 'No templates match your search' : emptyLabel}
                        </ActionSelect.Empty>
                    ) : (
                        filteredItems.map(item => {
                            const Icon = getIconComponent(item.icon);

                            return (
                                <ActionSelect.Item
                                    key={item.id}
                                    onClick={() => onSelect(item)}
                                    action={
                                        onDelete ? (
                                            <ConfirmButton
                                                onConfirm={() => onDelete(item.id)}
                                                label=""
                                                size="sm"
                                                confirmMode="iconOnly"
                                                showTriggerIcon={true}
                                            />
                                        ) : undefined
                                    }
                                    className="!py-2.5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center bg-theme-hover">
                                            <Icon size={18} className="text-theme-secondary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-theme-primary truncate">
                                                {item.title || 'Untitled'}
                                            </div>
                                            {item.subtitle && (
                                                <div className="text-xs text-theme-tertiary truncate">
                                                    {item.subtitle}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </ActionSelect.Item>
                            );
                        })
                    )}
                </ActionSelect.Items>
            </ActionSelect.Content>
        </ActionSelect>
    );
}

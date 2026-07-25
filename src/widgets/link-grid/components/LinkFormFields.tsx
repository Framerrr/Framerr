import React, { useEffect } from 'react';
import { Checkbox, Select, Input } from '../../../shared/ui';
import IconPicker from '../../../components/IconPicker';
import { useDashboards } from '../../../api/hooks/useDashboards';
import { getIconComponent } from '../../../utils/iconUtils';
import { parseDashboardDeepLink } from '../utils/linkNavigation';
import type { LinkFormData, HttpMethod } from '../types';

interface LinkFormFieldsProps {
    variant: 'grid' | 'tabBar';
    formData: LinkFormData;
    setFormData: React.Dispatch<React.SetStateAction<LinkFormData>>;
    onValidityChange?: (valid: boolean) => void;
}

export function LinkFormFields({
    variant,
    formData,
    setFormData,
    onValidityChange,
}: LinkFormFieldsProps): React.JSX.Element {
    const { data: dashboardsData } = useDashboards();
    const dashboards = dashboardsData?.dashboards ?? [];

    useEffect(() => {
        if (variant !== 'tabBar') return;
        if (formData.linkTarget === 'dashboard' || formData.dashboardId) {
            setFormData(prev => ({
                ...prev,
                linkTarget: 'url',
                dashboardId: '',
                url: prev.linkTarget === 'dashboard' ? '' : prev.url,
            }));
        }
    }, [variant, formData.linkTarget, formData.dashboardId, setFormData]);

    const dashboardDeepLinkBlocked =
        variant === 'tabBar' &&
        formData.type === 'link' &&
        !!parseDashboardDeepLink(formData.url);

    useEffect(() => {
        if (variant === 'tabBar' && onValidityChange) {
            onValidityChange(!dashboardDeepLinkBlocked);
        }
    }, [variant, dashboardDeepLinkBlocked, onValidityChange]);

    return (
        <div className="space-y-5">
            <Input
                label="Title"
                size="md"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter link title"
                className="!mb-0"
            />

            {variant === 'grid' && (
                <div className="pt-0.5">
                    <label className="block text-sm text-theme-secondary mb-2">Shape</label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, size: 'circle' })}
                            className={`flex-1 p-3 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-2 ${formData.size === 'circle'
                                ? 'bg-accent text-white'
                                : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                                }`}
                        >
                            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${formData.size === 'circle' ? 'border-white' : 'border-theme'}`}>
                                <span className="text-xs font-medium">1×1</span>
                            </div>
                            <span className="text-xs font-medium">Circle</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, size: 'rectangle' })}
                            className={`flex-1 p-3 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-2 ${formData.size === 'rectangle'
                                ? 'bg-accent text-white'
                                : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                                }`}
                        >
                            <div className={`w-20 h-12 rounded-full border-2 flex items-center justify-center ${formData.size === 'rectangle' ? 'border-white' : 'border-theme'}`}>
                                <span className="text-xs font-medium">2×1</span>
                            </div>
                            <span className="text-xs font-medium">Rectangle</span>
                        </button>
                    </div>
                </div>
            )}

            <div>
                <label className="block text-sm text-theme-secondary mb-2">Type</label>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'link' })}
                        className={`flex-1 p-3 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${formData.type === 'link'
                            ? 'bg-accent text-white'
                            : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                            }`}
                    >
                        Open Link
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'action' })}
                        className={`flex-1 p-3 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${formData.type === 'action'
                            ? 'bg-accent text-white'
                            : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                            }`}
                    >
                        HTTP Action
                    </button>
                </div>
            </div>

            {formData.type === 'link' ? (
                variant === 'grid' ? (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm text-theme-secondary mb-2">Destination</label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setFormData({
                                        ...formData,
                                        linkTarget: 'url',
                                        url: formData.linkTarget === 'dashboard' ? '' : formData.url,
                                        dashboardId: '',
                                    })}
                                    className={`flex-1 p-3 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${formData.linkTarget === 'url'
                                        ? 'bg-accent text-white'
                                        : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                                        }`}
                                >
                                    URL
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, linkTarget: 'dashboard' })}
                                    className={`flex-1 p-3 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${formData.linkTarget === 'dashboard'
                                        ? 'bg-accent text-white'
                                        : 'bg-theme-tertiary text-theme-secondary hover:bg-theme-hover'
                                        }`}
                                >
                                    Dashboard
                                </button>
                            </div>
                        </div>

                        {formData.linkTarget === 'dashboard' ? (
                            <div>
                                <label className="block text-sm text-theme-secondary mb-2">Dashboard</label>
                                <Select
                                    value={formData.dashboardId || undefined}
                                    onValueChange={(dashboardId) => {
                                        const selected = dashboards.find((d) => d.id === dashboardId);
                                        setFormData({
                                            ...formData,
                                            dashboardId,
                                            title: selected?.name || formData.title,
                                            icon: selected?.icon || 'LayoutDashboard',
                                        });
                                    }}
                                >
                                    <Select.Trigger className="w-full">
                                        <Select.Value placeholder="Select a dashboard" />
                                    </Select.Trigger>
                                    <Select.Content>
                                        {dashboards.map((dashboard) => {
                                            const DashIcon = getIconComponent(dashboard.icon || 'LayoutDashboard');
                                            return (
                                                <Select.Item key={dashboard.id} value={dashboard.id}>
                                                    <span className="inline-flex items-center gap-2">
                                                        <DashIcon size={14} className="shrink-0" />
                                                        {dashboard.name}
                                                    </span>
                                                </Select.Item>
                                            );
                                        })}
                                    </Select.Content>
                                </Select>
                                <p className="mt-1.5 text-xs text-theme-tertiary">
                                    Opens in this tab and switches dashboard.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <Input
                                    label="URL"
                                    size="md"
                                    type="url"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    placeholder="https://example.com"
                                    className="!mb-0"
                                />
                                <label className="flex items-center gap-2 pt-1 text-sm text-theme-secondary cursor-pointer">
                                    <Checkbox
                                        checked={formData.openInNewTab}
                                        onCheckedChange={(checked) => setFormData({
                                            ...formData,
                                            openInNewTab: checked === true,
                                        })}
                                        size="sm"
                                    />
                                    Open in new tab
                                </label>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <Input
                            label="URL"
                            size="md"
                            type="url"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            placeholder="https://example.com"
                            className="!mb-0"
                        />
                        {dashboardDeepLinkBlocked && (
                            <p className="text-sm text-error">
                                Dashboard shortcuts aren&apos;t supported here — pick a Dashboard slot from Add instead.
                            </p>
                        )}
                        <label className="flex items-center gap-2 pt-1 text-sm text-theme-secondary cursor-pointer">
                            <Checkbox
                                checked={formData.openInNewTab}
                                onCheckedChange={(checked) => setFormData({
                                    ...formData,
                                    openInNewTab: checked === true,
                                })}
                                size="sm"
                            />
                            Open in new tab
                        </label>
                    </div>
                )
            ) : (
                <>
                    <div>
                        <label className="block text-sm text-theme-secondary mb-2">Method</label>
                        <Select value={formData.action.method} onValueChange={(value) => setFormData({
                            ...formData,
                            action: { ...formData.action, method: value as HttpMethod },
                        })}>
                            <Select.Trigger className="w-full">
                                <Select.Value placeholder="GET" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="GET">GET</Select.Item>
                                <Select.Item value="POST">POST</Select.Item>
                                <Select.Item value="PUT">PUT</Select.Item>
                                <Select.Item value="DELETE">DELETE</Select.Item>
                                <Select.Item value="PATCH">PATCH</Select.Item>
                            </Select.Content>
                        </Select>
                    </div>
                    <Input
                        label="Action URL"
                        size="md"
                        type="url"
                        value={formData.action.url}
                        onChange={(e) => setFormData({
                            ...formData,
                            action: { ...formData.action, url: e.target.value },
                        })}
                        placeholder="https://api.example.com/action"
                        className="!mb-0"
                    />
                </>
            )}

            <div>
                <label className="block text-sm text-theme-secondary mb-2">Icon</label>
                <IconPicker
                    value={formData.icon}
                    onChange={(icon: string) => setFormData({ ...formData, icon })}
                />
            </div>

            {variant === 'grid' && (
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-theme-secondary cursor-pointer">
                        <Checkbox
                            checked={formData.showIcon}
                            onCheckedChange={(checked) => setFormData({ ...formData, showIcon: checked === true })}
                            size="sm"
                        />
                        Show Icon
                    </label>
                    <label className="flex items-center gap-2 text-sm text-theme-secondary cursor-pointer">
                        <Checkbox
                            checked={formData.showText}
                            onCheckedChange={(checked) => setFormData({ ...formData, showText: checked === true })}
                            size="sm"
                        />
                        Show Text
                    </label>
                </div>
            )}
        </div>
    );
}
